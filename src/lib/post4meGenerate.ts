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
  titles: z.array(z.string()).optional(),
  description: z.string(),
  tags: z.array(z.string()),
  viralityScore: z.number().min(0).max(100).optional(),
  viralitySummary: z.string().max(400).optional(),
})

const post4meMultiRawSchema = z.object({
  results: z.array(post4mePlatformEntrySchema.extend({ platformId: z.string() })).optional(),
  platforms: z.record(post4mePlatformEntrySchema).optional(),
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
  const { block } = await formatAlgorithmContextForPlatform(platformId)
  return block
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

export async function generatePost4MeFromClip(params: {
  r2FileKey: string
  mimeType: string
  platformIds: string[]
  userPrompt?: string
  durationSeconds?: number
  platforms?: Platform[]
}): Promise<Post4MeResult[]> {
  const platformIds = params.platformIds.filter(Boolean)
  if (platformIds.length === 0) throw new Error('At least one platform is required')

  const apiKey = (process.env.GEMINI_API || '').trim()
  if (!apiKey) throw new Error('GEMINI_API is not configured')

  const buffer = await getFileFromR2(params.r2FileKey)
  if (!buffer) throw new Error('Clip not found in storage')

  const platformList = params.platforms ?? []
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

  const prompt = `You are an elite multi-platform viral growth strategist. Watch this clip once, then write DISTINCT publish-ready metadata for EACH platform — Facebook winning with a file does NOT mean the same caption works on TikTok, Instagram, or YouTube Shorts.

Target platforms: ${platformLabels}
Platform IDs (use exactly in response): ${platformIds.join(', ')}
${params.durationSeconds ? `Clip length: ~${Math.round(params.durationSeconds)}s` : ''}

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

    const multi = post4meMultiRawSchema.parse(parsed)
    const entries: Array<z.infer<typeof post4mePlatformEntrySchema> & { platformId: string }> =
      []

    if (multi.results?.length) {
      for (const row of multi.results) {
        if (row.platformId) entries.push(row as typeof entries[number])
      }
    } else if (multi.platforms) {
      for (const [platformId, row] of Object.entries(multi.platforms)) {
        entries.push({ ...row, platformId })
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
        viralitySummary: rawMeta.viralitySummary?.trim(),
      })
    }

    if (results.length === 0) {
      throw new Error('Gemini did not return metadata for any selected platform')
    }

    return results
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
