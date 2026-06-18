import { GoogleGenAI } from '@google/genai'
import { readAlgorithmSnapshotFromMongo } from '@/lib/algorithmSnapshotRead'

export const THUMBNAIL_RESEARCH_MODEL_DEFAULT = 'gemini-3.5-flash'

const PLATFORM_LABELS: Record<string, string> = {
  'youtube-shorts': 'YouTube Shorts',
  'youtube-long': 'YouTube (long-form)',
  tiktok: 'TikTok',
  instagram: 'Instagram Reels / feed',
  'facebook-reels': 'Facebook Reels',
  twitter: 'X (Twitter)',
  kick: 'Kick',
  twitch: 'Twitch',
}

export const THUMBNAIL_PLATFORM_KNOWLEDGE = {
  streaming: [
    'Twitch — purple/black palette, LIVE badges, chat/HUD energy, face-cam layouts',
    'Kick — green/black palette, bold streamer headline type, live badge motifs',
    'YouTube Live — red/white live pill, play-button motifs, widescreen stream thumb',
    'Facebook Gaming — blue gaming badge energy, live indicator',
  ],
  socialShortForm: [
    'TikTok — vertical 9:16, hook text in first frame, sticker/emoji collage',
    'YouTube Shorts — vertical, huge hook line, red play icon motif, high contrast',
    'Instagram Reels — vertical, polished creator aesthetic, save/share hook text',
    'Facebook Reels — vertical, entertainment-first, comment-bait headline',
  ],
  socialLongOrFeed: [
    'YouTube (horizontal) — yellow/white/red outlined headline, arrows/circles, busy collage',
    'X / Twitter — landscape or 16:9, punchy headline, high contrast',
  ],
  media: [
    'Netflix / Hulu / Disney+ / HBO / Crunchyroll — cinematic key-art mood when referenced',
    'Spotify / podcast — audio-wave or mic motifs when referenced',
  ],
} as const

export type ThumbnailResearchResult = {
  visualBrief: string
  detectedStreamingPlatforms: string[]
  detectedSocialPlatforms: string[]
  detectedGamesOrMedia: string[]
  logosAndWordmarks: string[]
  onImageText: string[]
  algorithmHooks: string[]
  paletteAndMood: string
}

export type PreparedThumbnailInstructions = {
  instructionPrompt: string
  originalPrompt: string
  geminiResearchUsed: boolean
  research: ThumbnailResearchResult | null
}

function geminiText(response: { text?: string }): string {
  return typeof response.text === 'string' ? response.text : ''
}

function parseResearchJson(raw: string): Partial<ThumbnailResearchResult> | null {
  let clean = raw.trim()
  if (clean.includes('```')) {
    clean = clean.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  }
  try {
    return JSON.parse(clean) as Partial<ThumbnailResearchResult>
  } catch {
    return null
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
}

function normalizeResearch(
  parsed: Partial<ThumbnailResearchResult> | null,
  fallbackBrief: string
): ThumbnailResearchResult {
  return {
    visualBrief:
      typeof parsed?.visualBrief === 'string' && parsed.visualBrief.trim().length > 12
        ? parsed.visualBrief.trim()
        : fallbackBrief.trim(),
    detectedStreamingPlatforms: asStringArray(parsed?.detectedStreamingPlatforms),
    detectedSocialPlatforms: asStringArray(parsed?.detectedSocialPlatforms),
    detectedGamesOrMedia: asStringArray(parsed?.detectedGamesOrMedia),
    logosAndWordmarks: asStringArray(parsed?.logosAndWordmarks),
    onImageText: asStringArray(parsed?.onImageText),
    algorithmHooks: asStringArray(parsed?.algorithmHooks),
    paletteAndMood:
      typeof parsed?.paletteAndMood === 'string' ? parsed.paletteAndMood.trim() : '',
  }
}

async function algorithmContextForPlatforms(
  platformIds: string[] | undefined
): Promise<string> {
  const ids = Array.isArray(platformIds) ? platformIds : []
  if (ids.length === 0) return ''

  const snapshot = await readAlgorithmSnapshotFromMongo()
  const data = snapshot?.data
  if (!data || typeof data !== 'object') return ''

  const chunks: string[] = []
  for (const id of ids) {
    const entry = data[id]
    if (!entry || typeof entry !== 'object') continue
    const rec = entry as Record<string, unknown>
    const label = PLATFORM_LABELS[id] || id
    const summaries = asStringArray(rec.summaries).slice(0, 4)
    const titleTips =
      typeof rec.titleTips === 'string' ? rec.titleTips.slice(0, 280) : ''
    const editingTips =
      typeof rec.editingTips === 'string' ? rec.editingTips.slice(0, 220) : ''
    if (summaries.length === 0 && !titleTips && !editingTips) continue
    chunks.push(
      [
        `**${label} algorithm snapshot:**`,
        summaries.length ? `Insights: ${summaries.join(' | ')}` : '',
        titleTips ? `Title/thumbnail copy: ${titleTips}` : '',
        editingTips ? `Visual pacing: ${editingTips}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  if (chunks.length === 0) return ''
  return `\n\nStored platform algorithm notes (apply to layout, hooks, and on-image text):\n${chunks.join('\n\n')}`
}

function buildResearchSystemContext(platformIds: string[] | undefined): string {
  const selected =
    Array.isArray(platformIds) && platformIds.length > 0
      ? platformIds.map((id) => PLATFORM_LABELS[id] || id).join(', ')
      : 'none selected'

  return `You are an expert thumbnail strategist for creators across live streaming and social video.

Platform knowledge:
• Streaming: ${THUMBNAIL_PLATFORM_KNOWLEDGE.streaming.join('; ')}
• Short-form social: ${THUMBNAIL_PLATFORM_KNOWLEDGE.socialShortForm.join('; ')}
• Feed / horizontal social: ${THUMBNAIL_PLATFORM_KNOWLEDGE.socialLongOrFeed.join('; ')}
• Media / entertainment: ${THUMBNAIL_PLATFORM_KNOWLEDGE.media.join('; ')}

Logo guidance:
• When the creator names or implies a platform (Twitch, Kick, YouTube, TikTok, Instagram, X, etc.), prescribe the **correct official-style wordmark/logo badge** for that brand.
• Streaming platforms use different logo colors (Twitch purple, Kick green, YouTube red, TikTok cyan/pink, etc.).

User-selected target surface(s): ${selected}.`
}

export function formatThumbnailResearchBlock(research: ThumbnailResearchResult): string {
  const lines: string[] = []

  if (research.paletteAndMood) {
    lines.push(`Palette & mood: ${research.paletteAndMood}`)
  }
  if (research.logosAndWordmarks.length) {
    lines.push(
      `Logos/wordmarks to render as crisp badges: ${research.logosAndWordmarks.join('; ')}`
    )
  }
  if (research.onImageText.length) {
    lines.push(
      `Exact on-image text to paint (spell correctly): ${research.onImageText.map((t) => `"${t}"`).join(', ')}`
    )
  }
  if (research.algorithmHooks.length) {
    lines.push(`Algorithm-driven layout hooks: ${research.algorithmHooks.join(' | ')}`)
  }

  if (lines.length === 0) return ''
  return `\n\n**Gemini research brief:**\n${lines.map((l) => `• ${l}`).join('\n')}`
}

async function spellcheckBrief(
  apiKey: string,
  modelId: string,
  userPrompt: string
): Promise<string | null> {
  const safeNotes = userPrompt.replace(/"""/g, '"')
  const metaPrompt = `Fix spelling typos in creator notes for a thumbnail generator. Keep the same length and meaning. Output only the corrected notes.

"""
${safeNotes}
"""`

  try {
    const genAI = new GoogleGenAI({ apiKey })
    const response = await genAI.models.generateContent({
      model: modelId,
      contents: [{ role: 'user', parts: [{ text: metaPrompt }] }],
    })
    const cleaned = geminiText(response as { text?: string }).trim()
    return cleaned.length >= 3 ? cleaned : null
  } catch {
    return null
  }
}

export async function researchThumbnailPrompt(params: {
  userPrompt: string
  platformIds: string[] | undefined
  apiKey: string
  modelId: string
  thinkingLevel?: string
}): Promise<ThumbnailResearchResult | null> {
  const algoContext = await algorithmContextForPlatforms(params.platformIds)
  const systemContext = buildResearchSystemContext(params.platformIds)
  const safeNotes = params.userPrompt.replace(/"""/g, '"')

  const metaPrompt = `${systemContext}${algoContext}

Analyze the creator notes. Identify streaming vs social platforms vs games/media; choose logo badges; apply algorithm hooks.

Return **only valid JSON** (no markdown fences):
{
  "visualBrief": "One paragraph (max 130 words) with concrete visual directions and painted typography.",
  "detectedStreamingPlatforms": ["Twitch"],
  "detectedSocialPlatforms": ["YouTube Shorts"],
  "detectedGamesOrMedia": ["Windrose"],
  "logosAndWordmarks": ["Twitch purple wordmark badge bottom-left"],
  "onImageText": ["LIVE ON TWITCH", "NEW BOSS FIGHT"],
  "algorithmHooks": ["3-second hook as giant headline"],
  "paletteAndMood": "short palette note"
}

Creator notes:
"""
${safeNotes}
"""`

  try {
    const genAI = new GoogleGenAI({ apiKey })
    const modelId = params.modelId.trim() || THUMBNAIL_RESEARCH_MODEL_DEFAULT
    const thinkingConfig = {
      thinkingLevel: (params.thinkingLevel || 'MEDIUM').toUpperCase(),
    }

    const response = await genAI.models.generateContent({
      model: modelId,
      contents: [{ role: 'user', parts: [{ text: metaPrompt }] }],
      config: { thinkingConfig } as { thinkingConfig?: Record<string, unknown> },
    })

    const raw = geminiText(response as { text?: string })
    if (!raw.trim()) return null

    const parsed = parseResearchJson(raw)
    const normalized = normalizeResearch(parsed, raw)
    if (!normalized.visualBrief || normalized.visualBrief.length < 12) return null
    return normalized
  } catch (e) {
    console.warn('[Thumbnail] Gemini research failed:', e)
    return null
  }
}

export async function prepareThumbnailInstructions(params: {
  userPrompt: string
  platforms: string[] | undefined
  apiKey: string
  modelId: string
  maxPromptLength: number
  thinkingLevel?: string
}): Promise<PreparedThumbnailInstructions> {
  const truncated =
    params.userPrompt.length > params.maxPromptLength
      ? params.userPrompt.slice(0, params.maxPromptLength) + '...'
      : params.userPrompt

  let instructionPrompt = truncated
  let geminiResearchUsed = false
  let research: ThumbnailResearchResult | null = null

  if (params.apiKey) {
    research = await researchThumbnailPrompt({
      userPrompt: truncated,
      platformIds: params.platforms,
      apiKey: params.apiKey,
      modelId: params.modelId,
      thinkingLevel: params.thinkingLevel,
    })
    if (research) {
      geminiResearchUsed = true
      instructionPrompt =
        research.visualBrief.length > params.maxPromptLength
          ? research.visualBrief.slice(0, params.maxPromptLength) + '...'
          : research.visualBrief
    } else {
      const spellcheckDisabled =
        process.env.THUMBNAIL_GEMINI_SPELLCHECK?.trim().toLowerCase() === '0'
      if (!spellcheckDisabled) {
        const fixed = await spellcheckBrief(params.apiKey, params.modelId, truncated)
        if (fixed) {
          instructionPrompt =
            fixed.length > params.maxPromptLength
              ? fixed.slice(0, params.maxPromptLength) + '...'
              : fixed
        }
      }
    }
  }

  return {
    instructionPrompt,
    originalPrompt: truncated,
    geminiResearchUsed,
    research,
  }
}
