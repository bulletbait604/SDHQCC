import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { getFileFromR2 } from '@/lib/r2'
import {
  deleteGeminiUploadedFile,
  pollGeminiFileUntilActive,
  uploadBufferToGeminiFilesApi,
} from '@/lib/geminiFiles'
import { formatAlgorithmContextForPlatform } from '@/lib/algorithmContext'
import {
  post4meMultiPlatformRulesBlock,
  post4meRecommendedTagCount,
  post4meTagViralityRules,
  post4meTitleHooksBlock,
} from '@/lib/post4meViralityPrompt'
import {
  isYouTubeClipPlatform,
  normalizeClipAnalysisMetadata,
  type NormalizedClipMetadata,
} from '@/lib/clipAnalyzerMetadata'
import type { Platform } from '@/lib/home/types'

const MODEL_NAME = 'gemini-2.5-flash'

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  'youtube-shorts': 'YouTube Shorts',
  'youtube-long': 'YouTube (long-form)',
  'facebook-reels': 'Facebook Reels',
}

const post4mePlatformEntrySchema = z.object({
  platformId: z.string().optional(),
  title: z.string().optional(),
  titles: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
  description: z.union([z.string(), z.number(), z.boolean()]).optional(),
  tags: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
  viralityScore: z.union([z.number(), z.string()]).optional(),
  viralitySummary: z.union([z.string(), z.number(), z.boolean()]).optional(),
})

const post4meMultiRawSchema = z.object({
  results: z.array(z.record(z.unknown())).optional(),
  platforms: z.record(z.unknown()).optional(),
})

type CoercedPost4MeEntry = {
  platformId: string
  title?: string
  titles?: string[]
  description: string
  tags: string[]
  viralityScore?: number
  viralitySummary?: string
}

function coercePost4MePlatformEntry(
  platformId: string,
  raw: unknown
): CoercedPost4MeEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = post4mePlatformEntrySchema.safeParse(raw)
  if (!parsed.success) return null
  const row = parsed.data
  const description =
    row.description != null ? String(row.description).trim() : ''
  const tags = Array.isArray(row.tags)
    ? row.tags.map((t) => String(t).trim()).filter(Boolean)
    : []
  const titles = Array.isArray(row.titles)
    ? row.titles.map((t) => String(t).trim()).filter(Boolean)
    : []
  let viralityScore: number | undefined
  if (typeof row.viralityScore === 'number' && Number.isFinite(row.viralityScore)) {
    viralityScore = Math.max(0, Math.min(100, row.viralityScore))
  } else if (typeof row.viralityScore === 'string') {
    const n = Number(row.viralityScore)
    if (Number.isFinite(n)) viralityScore = Math.max(0, Math.min(100, n))
  }
  const viralitySummary =
    row.viralitySummary != null
      ? String(row.viralitySummary).trim().slice(0, 600)
      : undefined
  // Need at least a description or titles to be usable
  if (!description && titles.length === 0) return null
  return {
    platformId,
    title: row.title != null ? String(row.title) : titles[0],
    titles: titles.length ? titles : undefined,
    description: description || titles[0] || '',
    tags,
    viralityScore,
    viralitySummary: viralitySummary || undefined,
  }
}

export type Post4MeResult = NormalizedClipMetadata & {
  platformId: string
  isYouTube: boolean
  viralityScore?: number
  viralitySummary?: string
}

function extractFirstBalancedJsonObject(raw: string): string | null {
  const s = raw.trim()
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

function normalizeMimeType(mimeType: string): string {
  const m = (mimeType || '').trim().toLowerCase()
  if (!m || m === 'application/octet-stream') return 'video/mp4'
  if (m.startsWith('video/')) return m
  return 'video/mp4'
}

async function algorithmContextForPlatform(platformId: string): Promise<string> {
  try {
    const { block } = await formatAlgorithmContextForPlatform(platformId)
    // Keep Post4Me prompts bounded — oversized algo dumps cause Gemini timeouts / bad JSON.
    return block.length > 1800 ? `${block.slice(0, 1797)}...` : block
  } catch (error) {
    console.warn('[Post4Me] Algorithm context unavailable:', error)
    return ''
  }
}

function tagGuidance(platformId: string, _platforms: Platform[]): string {
  const count = post4meRecommendedTagCount(platformId)
  const viralRules = post4meTagViralityRules(platformId)
  const isYouTube = isYouTubeClipPlatform(platformId)
  if (isYouTube) {
    return `${viralRules} Aim for about ${count} plain keywords WITHOUT #.`
  }
  return `${viralRules} Provide about ${count} hashtags WITH # prefix.`
}

type GeminiMediaPart =
  | { text: string }
  | { fileData: { fileUri: string; mimeType: string } }
  | { inlineData: { data: string; mimeType: string } }

export type Post4MeSampleFrame = {
  timestampSeconds: number
  imageBase64: string
  mimeType?: string
}

async function runPost4MeFromParts(params: {
  apiKey: string
  parts: GeminiMediaPart[]
  platformIds: string[]
  userPrompt?: string
  durationNote: string
  platforms?: Platform[]
}): Promise<Post4MeResult[]> {
  const platformIds = params.platformIds.filter(Boolean)
  if (platformIds.length === 0) throw new Error('At least one platform is required')

  const platformList = params.platforms ?? []
  const userDirection = params.userPrompt?.trim()
    ? `\nCreator direction (honor this when writing copy):\n${params.userPrompt.trim()}`
    : ''

  const platformLabels = platformIds
    .map((id) => PLATFORM_LABELS[id] || id)
    .join(', ')
  const algoBlocks = await Promise.all(
    platformIds.map(async (id) => {
      const ctx = await algorithmContextForPlatform(id)
      return ctx ? `\n${ctx}` : ''
    })
  )
  const multiRules = post4meMultiPlatformRulesBlock(platformIds)

  const perPlatformTagRules = platformIds
    .map(
      (id) =>
        `- ${PLATFORM_LABELS[id] || id}: ${tagGuidance(id, platformList)}`
    )
    .join('\n')

  const prompt = `You are an elite multi-platform viral growth strategist. Study this clip (or stills from a window of it), then write DISTINCT publish-ready metadata for EACH platform — Facebook winning with a file does NOT mean the same caption works on TikTok, Instagram, or YouTube Shorts.

Target platforms: ${platformLabels}
Platform IDs (use exactly in response): ${platformIds.join(', ')}
${params.durationNote}

${algoBlocks.filter(Boolean).join('\n')}
${multiRules}
${userDirection}

GLOBAL REQUIREMENTS:
- Analyze the clip once (topic, hook, emotion, niche, share trigger), then REWRITE per platform. Identical hooks/captions across platforms = failure.
- Real-world pattern: Facebook Reels often gets far more views than TikTok/IG/Shorts on the same video+thumbnail. Score each platform honestly; boost non-FB platforms with native hooks/tags, not by copying FB copy.
- TITLES/Hooks are the most important output. Every platform MUST have exactly 3 distinct, clip-specific hook lines.
- Each platform entry must follow THAT platform's metadata + playbook rules.
- Tag guidance per platform:
${perPlatformTagRules}

${post4meTitleHooksBlock(platformIds[0] || 'tiktok')}

Return valid JSON only (no markdown):
{
  "results": [
    {
      "platformId": "tiktok",
      "viralityScore": 72,
      "viralitySummary": "Why this fits TikTok + one risk + one tweak (do not assume Facebook scores)",
      "titles": ["tiktok-native hook 1", "tiktok-native hook 2", "tiktok-native hook 3"],
      "title": "same as titles[0]",
      "description": "platform-native body without hashtags",
      "tags": ["#tag1", "#tag2"]
    }
  ]
}

Include one object in "results" for EVERY platform ID listed above. Order results the same as the platform ID list.`

  const genAI = new GoogleGenAI({ apiKey: params.apiKey })
  const response = await genAI.models.generateContent({
    model: MODEL_NAME,
    contents: [
      {
        role: 'user',
        parts: [...params.parts, { text: prompt }],
      },
    ],
    config: {
      temperature: 0.9,
    },
  })

  let raw =
    typeof (response as { text?: string }).text === 'string'
      ? (response as { text: string }).text
      : ''
  if (!raw.trim()) throw new Error('Gemini returned empty response')

  if (raw.includes('```')) {
    raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const extracted = extractFirstBalancedJsonObject(raw)
    if (!extracted) throw new Error('Could not parse Gemini response')
    parsed = JSON.parse(extracted)
  }

  const multi = post4meMultiRawSchema.safeParse(parsed)
  if (!multi.success) {
    console.error('[Post4Me] Unexpected Gemini JSON shape:', multi.error.message)
    throw new Error('Could not parse Gemini response')
  }

  const entries: CoercedPost4MeEntry[] = []

  if (multi.data.results?.length) {
    for (const row of multi.data.results) {
      const id =
        typeof (row as { platformId?: unknown }).platformId === 'string'
          ? String((row as { platformId: string }).platformId).trim().toLowerCase()
          : ''
      if (!id) continue
      const coerced = coercePost4MePlatformEntry(id, row)
      if (coerced) entries.push(coerced)
    }
  } else if (multi.data.platforms) {
    for (const [platformId, row] of Object.entries(multi.data.platforms)) {
      const coerced = coercePost4MePlatformEntry(platformId.trim().toLowerCase(), row)
      if (coerced) entries.push(coerced)
    }
  }

  const byId = new Map(entries.map((e) => [e.platformId.trim().toLowerCase(), e]))
  const results: Post4MeResult[] = []

  for (const platformId of platformIds) {
    const rawMeta = byId.get(platformId)
    if (!rawMeta) {
      console.warn(`[Post4Me] Missing platform in Gemini response: ${platformId}`)
      continue
    }
    const normalized = normalizeClipAnalysisMetadata(platformId, rawMeta)
    results.push({
      ...normalized,
      platformId,
      isYouTube: isYouTubeClipPlatform(platformId),
      viralityScore: rawMeta.viralityScore,
      viralitySummary: rawMeta.viralitySummary,
    })
  }

  if (results.length === 0) {
    throw new Error('Gemini did not return metadata for any selected platform')
  }

  return results
}

export async function generatePost4MeFromClip(params: {
  r2FileKey: string
  mimeType: string
  platformIds: string[]
  userPrompt?: string
  durationSeconds?: number
  platforms?: Platform[]
}): Promise<Post4MeResult[]> {
  const apiKey = (process.env.GEMINI_API || '').trim()
  if (!apiKey) throw new Error('GEMINI_API is not configured')

  const buffer = await getFileFromR2(params.r2FileKey)
  if (!buffer) throw new Error('Clip not found in storage')

  const uploaded = await uploadBufferToGeminiFilesApi({
    apiKey,
    buffer,
    mimeType: normalizeMimeType(params.mimeType),
    displayName: 'post4me-clip',
  })

  const cleanupName = uploaded.name
  await pollGeminiFileUntilActive(apiKey, uploaded.uri, { maxRetries: 60, retryDelayMs: 2000 })

  const durationNote = params.durationSeconds
    ? `Clip length: ~${Math.round(params.durationSeconds)}s`
    : ''

  try {
    return await runPost4MeFromParts({
      apiKey,
      parts: [
        {
          fileData: {
            fileUri: uploaded.uri,
            mimeType: normalizeMimeType(params.mimeType),
          },
        },
      ],
      platformIds: params.platformIds,
      userPrompt: params.userPrompt,
      durationNote,
      platforms: params.platforms,
    })
  } finally {
    await deleteGeminiUploadedFile(apiKey, cleanupName).catch(() => undefined)
  }
}

export async function generatePost4MeFromFrames(params: {
  frames: Post4MeSampleFrame[]
  platformIds: string[]
  userPrompt?: string
  chunkStartSeconds?: number
  chunkDurationSeconds?: number
  sourceDurationSeconds?: number
  platforms?: Platform[]
}): Promise<Post4MeResult[]> {
  const apiKey = (process.env.GEMINI_API || '').trim()
  if (!apiKey) throw new Error('GEMINI_API is not configured')

  const frames = params.frames.filter(
    (f) =>
      Number.isFinite(f.timestampSeconds) &&
      f.timestampSeconds >= 0 &&
      typeof f.imageBase64 === 'string' &&
      f.imageBase64.length > 80
  )
  if (frames.length < 1) throw new Error('No sample frames were provided')
  if (frames.length > 16) throw new Error('Too many sample frames')

  const parts: GeminiMediaPart[] = []
  for (const frame of frames) {
    const mime =
      typeof frame.mimeType === 'string' && frame.mimeType.startsWith('image/')
        ? frame.mimeType
        : 'image/jpeg'
    parts.push({ inlineData: { data: frame.imageBase64, mimeType: mime } })
    const m = Math.floor(frame.timestampSeconds / 60)
    const s = Math.floor(frame.timestampSeconds % 60)
    parts.push({ text: `Still at ${m}:${String(s).padStart(2, '0')}` })
  }

  const chunkMin =
    typeof params.chunkDurationSeconds === 'number'
      ? Math.round(params.chunkDurationSeconds / 60)
      : 5
  const sourceNote =
    typeof params.sourceDurationSeconds === 'number' && params.sourceDurationSeconds > 0
      ? `Source file is ~${Math.round(params.sourceDurationSeconds / 60)} minutes.`
      : ''
  const start =
    typeof params.chunkStartSeconds === 'number' ? Math.round(params.chunkStartSeconds) : 0
  const durationNote = `These stills are a RANDOM ~${chunkMin}-minute window starting at ${Math.floor(start / 60)}:${String(start % 60).padStart(2, '0')} of a longer upload. ${sourceNote} Write copy for THIS window only.`

  return runPost4MeFromParts({
    apiKey,
    parts,
    platformIds: params.platformIds,
    userPrompt: params.userPrompt,
    durationNote,
    platforms: params.platforms,
  })
}

export function estimatePost4MeUsd(durationSeconds: number): {
  estimatedCostUsd: number
  estimatedCostNote: string
} {
  const minutes = Math.max(0.25, durationSeconds / 60)
  const perMin = Number(process.env.ESTIMATE_POST4ME_USD_PER_MIN ?? '0.005')
  const base = Number(process.env.ESTIMATE_POST4ME_BASE_USD ?? '0.002')
  const usd = base + minutes * perMin
  return {
    estimatedCostUsd: Math.round(usd * 100_000) / 100_000,
    estimatedCostNote: `Gemini 2.5 Flash Post4Me (~${minutes.toFixed(1)} min @ ~$${perMin}/min est.)`,
  }
}
