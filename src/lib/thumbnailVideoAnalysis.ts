import { GoogleGenAI } from '@google/genai'
import { getFileFromR2, deleteFileFromR2 } from '@/lib/r2'
import {
  deleteGeminiUploadedFile,
  pollGeminiFileUntilActive,
  uploadBufferToGeminiFilesApi,
} from '@/lib/geminiFiles'
import { readAlgorithmSnapshotFromMongo } from '@/lib/algorithmSnapshotRead'
import {
  THUMBNAIL_CLIP_MAX_BYTES,
} from '@/lib/thumbnailClipLimits'
import {
  parseThumbnailVideoAnalysisJson,
  type ThumbnailVideoAnalysis,
} from '@/lib/thumbnailVideoAnalysisSchema'

export {
  thumbnailVideoAnalysisSchema,
  preprocessThumbnailVideoAnalysisRaw,
  type ThumbnailVideoAnalysis,
} from '@/lib/thumbnailVideoAnalysisSchema'

export {
  THUMBNAIL_CLIP_MAX_BYTES,
  THUMBNAIL_CLIP_MAX_DURATION_SECONDS,
  THUMBNAIL_CLIP_MAX_DURATION_FREE_SECONDS,
  THUMBNAIL_CLIP_MAX_DURATION_SUBSCRIBER_SECONDS,
  thumbnailClipMaxDurationSeconds,
  formatThumbnailClipLimitLabel,
  THUMBNAIL_CLIP_SUBSCRIBER_UPSELL,
} from '@/lib/thumbnailClipLimits'

export const THUMBNAIL_VIDEO_MODEL_DEFAULT = 'gemini-2.5-flash'

const PLATFORM_LABELS: Record<string, string> = {
  'youtube-shorts': 'YouTube Shorts',
  'youtube-long': 'YouTube (long-form horizontal)',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  'facebook-reels': 'Facebook Reels',
  twitter: 'X (Twitter)',
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
    ? rec.summaries.filter((s): s is string => typeof s === 'string').slice(0, 5)
    : []
  const titleTips = typeof rec.titleTips === 'string' ? rec.titleTips.slice(0, 300) : ''
  const editingTips = typeof rec.editingTips === 'string' ? rec.editingTips.slice(0, 220) : ''

  return [
    `**${label} algorithm snapshot:**`,
    summaries.length ? `Insights: ${summaries.join(' | ')}` : '',
    titleTips ? `Title/thumbnail copy: ${titleTips}` : '',
    editingTips ? `Visual pacing: ${editingTips}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function isVerticalPlatform(platformId: string): boolean {
  return ['youtube-shorts', 'tiktok', 'facebook-reels'].includes(platformId)
}

export function formatVideoAnalysisForThumbnailPrompt(
  analysis: ThumbnailVideoAnalysis,
  platformId: string
): string {
  const vertical = isVerticalPlatform(platformId)
  const aspect = vertical
    ? '9:16 vertical thumbnail (YouTube Shorts / TikTok / Reels)'
    : 'platform-appropriate aspect ratio'

  return [
    'Create a viral click-worthy thumbnail based on this analyzed clip moment.',
    `Target: ${PLATFORM_LABELS[platformId] || platformId} — ${aspect}.`,
    `Peak moment: ${analysis.bestMomentTimestamp}.`,
    `Subject: ${analysis.subjectDescription}`,
    `Hook energy: ${analysis.emotionalHook}`,
    analysis.onImageText.length
      ? `Paint this on-image text (spell exactly): ${analysis.onImageText.map((t) => `"${t}"`).join(', ')}`
      : '',
    `Colors: ${analysis.colorPalette}`,
    `Composition: ${analysis.compositionNotes}`,
    `Viral brief: ${analysis.viralThumbnailBrief}`,
    `Algorithm fit: ${analysis.algorithmAlignment}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function mergeUserPromptWithVideoAnalysis(
  userPrompt: string,
  analysis: ThumbnailVideoAnalysis,
  platformId: string
): string {
  const videoBlock = formatVideoAnalysisForThumbnailPrompt(analysis, platformId)
  const trimmed = userPrompt.trim()
  if (!trimmed) return videoBlock
  return `${videoBlock}\n\nCreator overrides / extra direction:\n${trimmed}`
}

export async function analyzeThumbnailReferenceClip(params: {
  r2FileKey: string
  mimeType: string
  platformId: string
  durationSeconds?: number
}): Promise<ThumbnailVideoAnalysis> {
  const apiKey = (process.env.GEMINI_API || '').trim()
  if (!apiKey) throw new Error('GEMINI_API is not configured')

  const buffer = await getFileFromR2(params.r2FileKey)
  if (!buffer) throw new Error('Reference clip not found in storage')

  const model =
    process.env.THUMBNAIL_GEMINI_MODEL?.trim() ||
    process.env.THUMBNAIL_VIDEO_GEMINI_MODEL?.trim() ||
    THUMBNAIL_VIDEO_MODEL_DEFAULT

  const uploaded = await uploadBufferToGeminiFilesApi({
    apiKey,
    buffer,
    mimeType: normalizeMimeType(params.mimeType),
    displayName: 'thumbnail-reference-clip',
  })

  const cleanupName = uploaded.name
  await pollGeminiFileUntilActive(apiKey, uploaded.uri, { maxRetries: 60, retryDelayMs: 2000 })

  const algoContext = await algorithmContextForPlatform(params.platformId)
  const vertical = isVerticalPlatform(params.platformId)
  const durationNote =
    typeof params.durationSeconds === 'number' && params.durationSeconds > 0
      ? `Clip duration: ~${Math.round(params.durationSeconds / 60)} minutes (${params.durationSeconds}s). Scan the FULL timeline for the single best thumbnail frame.`
      : 'Scan the full clip for the single best thumbnail-worthy moment.'

  const prompt = `You are an elite viral thumbnail strategist. Watch this entire reference clip.

Target platform: ${PLATFORM_LABELS[params.platformId] || params.platformId}
Thumbnail format: ${vertical ? 'VERTICAL 9:16 (mobile short-form — hook must read in first glance)' : 'Horizontal or platform-native aspect as appropriate'}
${durationNote}

${algoContext ? `Platform algorithm notes:\n${algoContext}` : ''}

Find the ONE peak moment that would maximize clicks on ${PLATFORM_LABELS[params.platformId] || params.platformId}. Consider facial expression, action peak, contrast, curiosity gap, and on-image text opportunities aligned with the platform algorithm.

Return valid JSON only (no markdown):
{
  "bestMomentTimestamp": "e.g. 12:34 or 0:45",
  "subjectDescription": "who/what is the focal subject at that moment",
  "emotionalHook": "the feeling that stops the scroll",
  "onImageText": ["2-4 short ALL-CAPS headline options to paint on the thumbnail"],
  "colorPalette": "dominant colors + mood (max 120 characters, comma-separated)",
  "compositionNotes": "where to place subject, text, and negative space for ${vertical ? '9:16 vertical' : 'this platform'} (max 300 chars)",
  "viralThumbnailBrief": "Detailed art direction paragraph for an AI image generator (130 words max)",
  "algorithmAlignment": "How this thumbnail leverages ${PLATFORM_LABELS[params.platformId] || params.platformId} discovery patterns"
}`

  try {
    const genAI = new GoogleGenAI({ apiKey })
    const response = await genAI.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { fileUri: uploaded.uri, mimeType: normalizeMimeType(params.mimeType) } },
            { text: prompt },
          ],
        },
      ],
    })

    const raw =
      typeof (response as { text?: string }).text === 'string'
        ? (response as { text: string }).text
        : ''

    if (!raw.trim()) throw new Error('Gemini returned empty video analysis')
    return parseThumbnailVideoAnalysisJson(raw)
  } finally {
    await deleteGeminiUploadedFile(apiKey, cleanupName).catch(() => undefined)
  }
}

export async function cleanupThumbnailReferenceClip(r2FileKey: string): Promise<void> {
  await deleteFileFromR2(r2FileKey).catch(() => undefined)
}

export function estimateThumbnailVideoAnalysisUsd(durationSeconds: number): {
  estimatedCostUsd: number
  estimatedCostNote: string
} {
  const minutes = Math.max(0.5, durationSeconds / 60)
  const perMin = Number(process.env.ESTIMATE_THUMBNAIL_VIDEO_ANALYSIS_USD_PER_MIN ?? '0.005')
  const base = Number(process.env.ESTIMATE_THUMBNAIL_VIDEO_ANALYSIS_BASE_USD ?? '0.002')
  const usd = base + minutes * perMin
  return {
    estimatedCostUsd: Math.round(usd * 100_000) / 100_000,
    estimatedCostNote: `Gemini 2.5 Flash video analysis (~${minutes.toFixed(1)} min @ ~$${perMin}/min est.)`,
  }
}
