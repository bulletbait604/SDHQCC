import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { getFileFromR2 } from '@/lib/r2'
import {
  deleteGeminiUploadedFile,
  pollGeminiFileUntilActive,
  uploadBufferToGeminiFilesApi,
} from '@/lib/geminiFiles'
import { readAlgorithmSnapshotFromMongo } from '@/lib/algorithmSnapshotRead'
import {
  post4meMetadataPromptBlock,
  post4meTagViralityRules,
  post4meViralityScoringBlock,
} from '@/lib/post4meViralityPrompt'
import {
  isYouTubeClipPlatform,
  normalizeClipAnalysisMetadata,
  type NormalizedClipMetadata,
} from '@/lib/clipAnalyzerMetadata'
import { getRecommendedTagCount } from '@/lib/home/tagUtils'
import type { Platform } from '@/lib/home/types'

const MODEL_NAME = 'gemini-2.5-flash'

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  'youtube-shorts': 'YouTube Shorts',
  'youtube-long': 'YouTube (long-form)',
  'facebook-reels': 'Facebook Reels',
}

const post4meRawSchema = z.object({
  title: z.string().optional(),
  titles: z.array(z.string()).optional(),
  description: z.string(),
  tags: z.array(z.string()),
  viralityScore: z.number().min(0).max(100).optional(),
  viralitySummary: z.string().max(400).optional(),
})

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
  const snapshot = await readAlgorithmSnapshotFromMongo()
  const data = snapshot?.data
  if (!data || typeof data !== 'object') return ''

  const entry = data[platformId]
  if (!entry || typeof entry !== 'object') return ''
  const rec = entry as Record<string, unknown>
  const label = PLATFORM_LABELS[platformId] || platformId
  const summaries = Array.isArray(rec.summaries)
    ? rec.summaries.filter((s): s is string => typeof s === 'string').slice(0, 6)
    : []
  const titleTips = typeof rec.titleTips === 'string' ? rec.titleTips.slice(0, 600) : ''
  const descriptionTips =
    typeof rec.descriptionTips === 'string' ? rec.descriptionTips.slice(0, 500) : ''
  const keyChanges =
    typeof rec.keyChanges === 'string' ? rec.keyChanges.slice(0, 500) : ''

  return [
    `**${label} algorithm snapshot:**`,
    summaries.length ? `Insights: ${summaries.join(' | ')}` : '',
    titleTips ? `Title/hook guidance: ${titleTips}` : '',
    descriptionTips ? `Description/caption guidance: ${descriptionTips}` : '',
    keyChanges ? `Algorithm ranking signals: ${keyChanges}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function tagGuidance(platformId: string, platforms: Platform[]): string {
  const count = getRecommendedTagCount(platformId, platforms)
  const viralRules = post4meTagViralityRules(platformId)
  const isYouTube = isYouTubeClipPlatform(platformId)
  if (isYouTube) {
    return `${viralRules} Minimum ${Math.min(8, count)} tags; aim for ${count}. Plain keywords WITHOUT #.`
  }
  return `${viralRules} Provide ${count} hashtags WITH # prefix.`
}

export async function generatePost4MeFromClip(params: {
  r2FileKey: string
  mimeType: string
  platformId: string
  userPrompt?: string
  durationSeconds?: number
  platforms?: Platform[]
}): Promise<Post4MeResult> {
  const apiKey = (process.env.GEMINI_API || '').trim()
  if (!apiKey) throw new Error('GEMINI_API is not configured')

  const buffer = await getFileFromR2(params.r2FileKey)
  if (!buffer) throw new Error('Clip not found in storage')

  const platformList = params.platforms ?? []
  const isYouTube = isYouTubeClipPlatform(params.platformId)
  const algoContext = await algorithmContextForPlatform(params.platformId)
  const userDirection = params.userPrompt?.trim()
    ? `\nCreator direction (honor this when writing copy):\n${params.userPrompt.trim()}`
    : ''

  const uploaded = await uploadBufferToGeminiFilesApi({
    apiKey,
    buffer,
    mimeType: normalizeMimeType(params.mimeType),
    displayName: 'post4me-clip',
  })

  const cleanupName = uploaded.name
  await pollGeminiFileUntilActive(apiKey, uploaded.uri, { maxRetries: 60, retryDelayMs: 2000 })

  const metadataBlock = post4meMetadataPromptBlock(params.platformId)
  const viralityBlock = post4meViralityScoringBlock(params.platformId)

  const prompt = `You are an elite viral growth strategist for ${PLATFORM_LABELS[params.platformId] || params.platformId}. Watch this clip and write publish-ready metadata engineered for maximum algorithmic reach and virality — not generic filler copy.

Target platform: ${PLATFORM_LABELS[params.platformId] || params.platformId}
${params.durationSeconds ? `Clip length: ~${Math.round(params.durationSeconds)}s` : ''}

${algoContext ? `Platform algorithm notes:\n${algoContext}\n` : ''}
${viralityBlock}
${userDirection}

Requirements:
- Analyze what happens in the clip (topic, hook, emotion, niche, share trigger).
- Maximize discovery, CTR, completion rate, and saves/shares for ${PLATFORM_LABELS[params.platformId] || params.platformId}.
- ${tagGuidance(params.platformId, platformList)}
${metadataBlock}

Return valid JSON only (no markdown):
{
  "viralityScore": 85,
  "viralitySummary": "Why the primary option should perform + one caveat",
  "titles": ["highest virality option first", "second hook variant", "third hook variant"],
  "title": "same as titles[0]",
  "description": "platform-optimized description/caption body",
  "tags": ["platform-appropriate tags or hashtags"]
}`

  try {
    const genAI = new GoogleGenAI({ apiKey })
    const response = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                fileUri: uploaded.uri,
                mimeType: normalizeMimeType(params.mimeType),
              },
            },
            { text: prompt },
          ],
        },
      ],
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

    const rawMeta = post4meRawSchema.parse(parsed)
    const normalized = normalizeClipAnalysisMetadata(params.platformId, rawMeta)

    return {
      ...normalized,
      platformId: params.platformId,
      isYouTube,
      viralityScore: rawMeta.viralityScore,
      viralitySummary: rawMeta.viralitySummary?.trim(),
    }
  } finally {
    await deleteGeminiUploadedFile(apiKey, cleanupName).catch(() => undefined)
  }
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
