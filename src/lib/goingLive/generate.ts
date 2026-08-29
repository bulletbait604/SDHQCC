import { GoogleGenAI, Modality } from '@google/genai'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { putBufferToR2 } from '@/lib/r2'
import {
  getGoingLiveSocial,
  type GoingLiveSocialId,
  type GoingLiveSocialPlatform,
  type GoingLiveStreamingPlatform,
  type GoingLiveTone,
} from '@/lib/goingLive/platforms'

const TEXT_MODEL = process.env.GOING_LIVE_TEXT_MODEL?.trim() || 'gemini-2.5-flash'
const IMAGE_MODEL =
  process.env.GOING_LIVE_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image'
const IMAGE_MODEL_FALLBACKS = [
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.0-flash-exp-image-generation',
]

const GEMINI_ASPECT_RATIOS = [
  '1:1',
  '3:2',
  '2:3',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
] as const

type GeminiAspectRatio = (typeof GEMINI_ASPECT_RATIOS)[number]

export type GoingLiveReference = {
  base64: string
  mimeType: string
}

export type GoingLivePost = {
  platformId: GoingLiveSocialId
  platformName: string
  /** Reddit-style headline when present. */
  title?: string
  copy: string
  poster: {
    key: string
    width: number
    height: number
    mimeType: string
  } | null
  posterError?: string
}

export type GoingLiveResult = {
  streamTitle: string
  liveUrl: string
  streamingPlatformId: string
  streamingPlatformName: string
  toneId: string
  username: string
  posts: GoingLivePost[]
  textModel: string
  imageModel: string
}

function stripDataUrlPrefix(raw: string): string {
  return raw.replace(/^data:[^;]+;base64,/, '').trim()
}

function nearestGeminiAspectRatio(width: number, height: number): GeminiAspectRatio {
  const target = width / Math.max(1, height)
  let best: GeminiAspectRatio = '16:9'
  let bestDiff = Number.POSITIVE_INFINITY
  for (const label of GEMINI_ASPECT_RATIOS) {
    const [a, b] = label.split(':').map(Number)
    const r = a / b
    const diff = Math.abs(r - target)
    if (diff < bestDiff) {
      bestDiff = diff
      best = label
    }
  }
  return best
}

async function resizeToExactSize(
  buffer: Buffer,
  width: number,
  height: number
): Promise<{ buffer: Buffer; mimeType: string }> {
  const out = await sharp(buffer)
    .rotate()
    .resize(width, height, {
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: false,
    })
    .png({ compressionLevel: 8 })
    .toBuffer()
  return { buffer: out, mimeType: 'image/png' }
}

function extractFirstBalancedJsonObject(raw: string): string | null {
  const s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const start = s.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (inString) {
      if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

function toneCopyBrief(tone: GoingLiveTone): string {
  switch (tone.id) {
    case 'funny':
      return 'Funny, punchy, streamer-chat energy. Jokes and bits — not cringe corporate memes.'
    case 'professional':
      return 'Clean, confident, creator-brand. Clear CTA. No slang overload.'
    case 'sincere':
      return 'Warm, genuine, inviting. Makes people feel welcome in chat.'
    case 'angry':
      return 'Chaotic gremlin / mock-rage energy (roast the algorithm, “get in here”). Never real hate, slurs, or targeting groups.'
    case 'adult':
      return 'Spicy, flirty, sexy/risqué adult-streamer vibe. Suggestive and playful — never explicit sexual acts, nudity, or pornographic wording.'
  }
}

function tonePosterBrief(tone: GoingLiveTone): string {
  switch (tone.id) {
    case 'funny':
      return 'Bold comedic poster energy: exaggerated expressions, playful type, bright contrast.'
    case 'professional':
      return 'Polished brand key art: clean type, strong composition, premium lighting.'
    case 'sincere':
      return 'Warm inviting poster: soft light, friendly face, approachable LIVE lockup.'
    case 'angry':
      return 'High-energy aggressive esports poster: grit, high contrast, “WE’RE LIVE” intensity — not hateful imagery.'
    case 'adult':
      return `Risqué adult-streamer poster: alluring pose/expression, dramatic lighting, tasteful spice.
HARD LIMITS: no nudity, no genitals, no sexual acts, no porn. Clothing stays on. Suggestive only.`
  }
}

function buildCopyPrompt(params: {
  streaming: GoingLiveStreamingPlatform
  socials: GoingLiveSocialPlatform[]
  tone: GoingLiveTone
  username: string
  liveUrl: string
  topic: string
}): string {
  const socialRules = params.socials
    .map((s) => {
      const cap = s.maxChars ? ` Max ${s.maxChars} characters for the copy field.` : ''
      return `- ${s.id} (${s.name}): ${s.copyHint}${cap}`
    })
    .join('\n')

  return `You write go-live copy for a streamer.

Streaming platform: ${params.streaming.name}
Stream username: ${params.username}
Live URL (include this in every social post): ${params.liveUrl}
Stream title max characters: ${params.streaming.titleMaxChars}
Vibe/tone: ${params.tone.name} — ${toneCopyBrief(params.tone)}
What they're streaming: ${params.topic || '(infer from the attached reference photos; if unclear, write a versatile variety/just-chatting title)'}

Write:
1) One stream TITLE for ${params.streaming.name} (not a social caption). Stay within ${params.streaming.titleMaxChars} characters. Hook viewers on that platform.
2) One ready-to-paste POST per social platform below. Match that network's native style. Always include the live URL. Use @${params.username} where it fits.

Social platforms:
${socialRules}

Look at attached reference images for the streamer's look, game, and vibe.

Return ONLY JSON:
{
  "streamTitle": "string",
  "posts": [
    {
      "platformId": "twitter",
      "title": "optional, Reddit headline only",
      "copy": "full post body ready to paste"
    }
  ]
}

Rules:
- posts must include every requested platformId exactly once: ${params.socials.map((s) => s.id).join(', ')}
- Twitter/X copy MUST be ≤ 280 characters including the URL.
- Reddit: put the feed headline in "title" and the self-text in "copy".
- Other platforms: omit title; put the entire caption in "copy".
- Do not invent extra platforms.
- No markdown fences.`
}

function fallbackPost(
  social: GoingLiveSocialPlatform,
  username: string,
  liveUrl: string,
  streamingName: string,
  tone: GoingLiveTone
): { title?: string; copy: string } {
  const handle = `@${username}`
  if (social.id === 'twitter') {
    const copy = `LIVE on ${streamingName} ${handle} — come hang. ${liveUrl}`
    return { copy: copy.slice(0, 280) }
  }
  if (social.id === 'reddit') {
    return {
      title: `${handle} is live on ${streamingName}`,
      copy: `Jump in: ${liveUrl}\n\nTone: ${tone.name}.`,
    }
  }
  return {
    copy: `${handle} is live on ${streamingName}.\n\n${liveUrl}`,
  }
}

type ParsedCopy = {
  streamTitle: string
  posts: Array<{ platformId: string; title?: string; copy: string }>
}

function parseCopyJson(raw: string, streamingTitleMax: number): ParsedCopy | null {
  const json = extractFirstBalancedJsonObject(raw)
  if (!json) return null
  try {
    const data = JSON.parse(json) as ParsedCopy
    if (!data || typeof data !== 'object') return null
    const streamTitle =
      typeof data.streamTitle === 'string' ? data.streamTitle.trim().slice(0, streamingTitleMax) : ''
    if (!streamTitle) return null
    const posts = Array.isArray(data.posts) ? data.posts : []
    return {
      streamTitle,
      posts: posts
        .filter((p) => p && typeof p.platformId === 'string' && typeof p.copy === 'string')
        .map((p) => ({
          platformId: p.platformId.trim().toLowerCase(),
          title: typeof p.title === 'string' ? p.title.trim() : undefined,
          copy: p.copy.trim(),
        })),
    }
  } catch {
    return null
  }
}

async function generateCopy(params: {
  genAI: GoogleGenAI
  streaming: GoingLiveStreamingPlatform
  socials: GoingLiveSocialPlatform[]
  tone: GoingLiveTone
  username: string
  liveUrl: string
  topic: string
  references: GoingLiveReference[]
}): Promise<{ parsed: ParsedCopy; model: string }> {
  const parts: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }> = []
  for (const ref of params.references.slice(0, 4)) {
    parts.push({
      inlineData: {
        data: stripDataUrlPrefix(ref.base64),
        mimeType: ref.mimeType || 'image/jpeg',
      },
    })
  }
  parts.push({ text: buildCopyPrompt(params) })

  const response = await params.genAI.models.generateContent({
    model: TEXT_MODEL,
    contents: [{ role: 'user', parts }],
    config: { temperature: 0.85 },
  })
  const raw = response.text?.trim() || ''
  const parsed = parseCopyJson(raw, params.streaming.titleMaxChars)
  if (!parsed) {
    throw new Error('Could not parse go-live copy from the model')
  }
  return { parsed, model: TEXT_MODEL }
}

async function generateOneImage(params: {
  genAI: GoogleGenAI
  promptText: string
  references: GoingLiveReference[]
  targetWidth: number
  targetHeight: number
}): Promise<{ buffer: Buffer; mimeType: string; model: string }> {
  const models = [IMAGE_MODEL, ...IMAGE_MODEL_FALLBACKS].filter(
    (m, i, arr) => m && arr.indexOf(m) === i
  )
  const aspectRatio = nearestGeminiAspectRatio(params.targetWidth, params.targetHeight)
  const parts: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }> = []
  for (const ref of params.references.slice(0, 4)) {
    parts.push({
      inlineData: {
        data: stripDataUrlPrefix(ref.base64),
        mimeType: ref.mimeType || 'image/jpeg',
      },
    })
  }
  parts.push({ text: params.promptText })

  let lastError: unknown
  for (const model of models) {
    for (const modalities of [[Modality.IMAGE], [Modality.TEXT, Modality.IMAGE]] as const) {
      try {
        const response = await params.genAI.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: {
            responseModalities: [...modalities],
            imageConfig: { aspectRatio },
          },
        })
        const outParts = response.candidates?.[0]?.content?.parts ?? []
        const imagePart = outParts.find(
          (p) =>
            p &&
            typeof p === 'object' &&
            'inlineData' in p &&
            (p as { inlineData?: { mimeType?: string } }).inlineData?.mimeType?.startsWith(
              'image/'
            )
        ) as { inlineData?: { data?: string; mimeType?: string } } | undefined

        if (!imagePart?.inlineData?.data || !imagePart.inlineData.mimeType) {
          throw new Error('Gemini returned no image')
        }
        const raw = Buffer.from(imagePart.inlineData.data, 'base64')
        const resized = await resizeToExactSize(raw, params.targetWidth, params.targetHeight)
        return { buffer: resized.buffer, mimeType: resized.mimeType, model }
      } catch (error) {
        lastError = error
        if (
          String(error).toLowerCase().includes('imageconfig') ||
          String(error).toLowerCase().includes('aspect')
        ) {
          try {
            const response = await params.genAI.models.generateContent({
              model,
              contents: [{ role: 'user', parts }],
              config: { responseModalities: [...modalities] },
            })
            const outParts = response.candidates?.[0]?.content?.parts ?? []
            const imagePart = outParts.find(
              (p) =>
                p &&
                typeof p === 'object' &&
                'inlineData' in p &&
                (p as { inlineData?: { mimeType?: string } }).inlineData?.mimeType?.startsWith(
                  'image/'
                )
            ) as { inlineData?: { data?: string; mimeType?: string } } | undefined
            if (!imagePart?.inlineData?.data) throw error
            const raw = Buffer.from(imagePart.inlineData.data, 'base64')
            const resized = await resizeToExactSize(raw, params.targetWidth, params.targetHeight)
            return { buffer: resized.buffer, mimeType: resized.mimeType, model }
          } catch (inner) {
            lastError = inner
          }
        }
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Poster generation failed')
}

function buildPosterPrompt(params: {
  streaming: GoingLiveStreamingPlatform
  social: GoingLiveSocialPlatform
  tone: GoingLiveTone
  username: string
  topic: string
}): string {
  const { width, height } = params.social.poster
  const ratio = nearestGeminiAspectRatio(width, height)
  return `Create a GOING LIVE social poster for ${params.social.name}.

EXACT OUTPUT SIZE: ${width}×${height}px (model aspect ${ratio}). Full-bleed, no letterboxing.

Streamer username on the art (spelled exactly): ${params.username}
They are LIVE on ${params.streaming.name}.
Topic: ${params.topic || 'infer from reference photos'}
${tonePosterBrief(params.tone)}

Use the attached reference photos as the visual identity (person, colors, game, outfit). Keep the real subject recognizable.

Layout:
- Big readable "LIVE" or "NOW LIVE" lockup.
- Username "${params.username}" must appear, spelled correctly.
- Optional short ${params.streaming.name} line. Do NOT fake platform UI chrome or official logos.
- Designed poster / key art — not a screenshot of a tweet.

Output one finished poster image only.`
}

async function storePoster(params: {
  sessionId: string
  platformId: string
  buffer: Buffer
  mimeType: string
}): Promise<string> {
  const ext = params.mimeType.includes('png') ? 'png' : 'jpg'
  const key = `thumbnails/going-live/${params.sessionId}/${params.platformId}-${randomUUID().slice(0, 8)}.${ext}`
  const ok = await putBufferToR2(key, params.buffer, params.mimeType)
  if (!ok) throw new Error('Failed to store poster in R2')
  return key
}

async function generatePoster(params: {
  genAI: GoogleGenAI
  streaming: GoingLiveStreamingPlatform
  social: GoingLiveSocialPlatform
  tone: GoingLiveTone
  username: string
  topic: string
  references: GoingLiveReference[]
  sessionId: string
}): Promise<{ key: string; width: number; height: number; mimeType: string; model: string }> {
  const out = await generateOneImage({
    genAI: params.genAI,
    references: params.references,
    targetWidth: params.social.poster.width,
    targetHeight: params.social.poster.height,
    promptText: buildPosterPrompt(params),
  })
  const key = await storePoster({
    sessionId: params.sessionId,
    platformId: params.social.id,
    buffer: out.buffer,
    mimeType: out.mimeType,
  })
  return {
    key,
    width: params.social.poster.width,
    height: params.social.poster.height,
    mimeType: out.mimeType,
    model: out.model,
  }
}

function clipCopy(social: GoingLiveSocialPlatform, copy: string): string {
  if (!social.maxChars) return copy
  if (copy.length <= social.maxChars) return copy
  return copy.slice(0, social.maxChars)
}

export async function runGoingLivePipeline(params: {
  streaming: GoingLiveStreamingPlatform
  socialIds: GoingLiveSocialId[]
  tone: GoingLiveTone
  username: string
  topic: string
  references: GoingLiveReference[]
  sessionId?: string
}): Promise<GoingLiveResult> {
  const apiKey = (process.env.GEMINI_API || process.env.GOOGLE_API_KEY || '').trim()
  if (!apiKey) throw new Error('GEMINI_API is not configured')
  if (!params.references.length) throw new Error('Upload at least one reference image')

  const socials = params.socialIds
    .map((id) => getGoingLiveSocial(id))
    .filter((s): s is GoingLiveSocialPlatform => Boolean(s))
  if (!socials.length) throw new Error('Select at least one social platform')

  const username = params.username
  const liveUrl = params.streaming.liveUrl(username)
  const sessionId = params.sessionId || randomUUID()
  const genAI = new GoogleGenAI({ apiKey })

  const { parsed, model: textModel } = await generateCopy({
    genAI,
    streaming: params.streaming,
    socials,
    tone: params.tone,
    username,
    liveUrl,
    topic: params.topic,
    references: params.references,
  })

  const postsById = new Map(parsed.posts.map((p) => [p.platformId, p]))
  let imageModel = IMAGE_MODEL

  const posts: GoingLivePost[] = []
  for (const social of socials) {
    const fromModel = postsById.get(social.id)
    const fallback = fallbackPost(
      social,
      username,
      liveUrl,
      params.streaming.name,
      params.tone
    )
    const title = social.id === 'reddit' ? fromModel?.title || fallback.title : undefined
    const copy = clipCopy(social, fromModel?.copy || fallback.copy)

    let poster: GoingLivePost['poster'] = null
    let posterError: string | undefined
    try {
      const img = await generatePoster({
        genAI,
        streaming: params.streaming,
        social,
        tone: params.tone,
        username,
        topic: params.topic,
        references: params.references,
        sessionId,
      })
      imageModel = img.model
      poster = {
        key: img.key,
        width: img.width,
        height: img.height,
        mimeType: img.mimeType,
      }
    } catch (err) {
      posterError = err instanceof Error ? err.message : 'Poster generation failed'
      console.error('[going-live] poster', social.id, posterError)
    }

    posts.push({
      platformId: social.id,
      platformName: social.name,
      title,
      copy,
      poster,
      posterError,
    })
  }

  const streamTitle =
    parsed.streamTitle.slice(0, params.streaming.titleMaxChars) ||
    `${username} is live`

  return {
    streamTitle,
    liveUrl,
    streamingPlatformId: params.streaming.id,
    streamingPlatformName: params.streaming.name,
    toneId: params.tone.id,
    username,
    posts,
    textModel,
    imageModel,
  }
}
