import { GoogleGenAI } from '@google/genai'
import { getFileFromR2, deleteFileFromR2 } from '@/lib/r2'
import {
  deleteGeminiUploadedFile,
  pollGeminiFileUntilActive,
  uploadBufferToGeminiFilesApi,
} from '@/lib/geminiFiles'
import { formatThumbnailAlgorithmContextForPlatform } from '@/lib/algorithmContext'
import {
  THUMBNAIL_CLIP_MAX_BYTES,
} from '@/lib/thumbnailClipLimits'
import {
  buildViralClipAnalyzePrompt,
  THUMBNAIL_CLIP_VIDEO_MODEL_DEFAULT,
} from '@/lib/thumbnailViralClipPrompt'
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

/** Clip video analysis model — prefer 3.1 Flash-Lite (usable on new Gemini keys). */
export const THUMBNAIL_VIDEO_MODEL_DEFAULT = THUMBNAIL_CLIP_VIDEO_MODEL_DEFAULT

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

function isVerticalPlatform(platformId: string): boolean {
  return ['youtube-shorts', 'tiktok', 'facebook-reels', 'instagram'].includes(platformId)
}

export type ThumbnailPromptOptions = {
  clipFrameProvided?: boolean
  /** Thumbnail 2.0: stickers/text only; never invent people or scene objects. */
  stickerOnlyOverlays?: boolean
}

export function formatVideoAnalysisForThumbnailPrompt(
  analysis: ThumbnailVideoAnalysis,
  platformId: string,
  options?: ThumbnailPromptOptions
): string {
  const vertical = isVerticalPlatform(platformId)
  const aspect = vertical
    ? '9:16 vertical thumbnail (YouTube Shorts / TikTok / Reels)'
    : 'platform-appropriate aspect ratio'

  const frameBlock = options?.clipFrameProvided
    ? options.stickerOnlyOverlays
      ? `CRITICAL: The attached image IS the exact video frame at ${analysis.bestMomentTimestamp}. Keep every real person/face/enemy/UI/environment recognizable. You MUST pile on loud flat graphic overlays (big outlined text + emoji stickers + arrows + circles) so it reads as a viral Shorts/TikTok thumb — NOT a plain zoomed screenshot with a caption. Do NOT invent people, faces, characters, enemies, weapons, or scene objects.`
      : `CRITICAL: The attached image IS the exact video frame at ${analysis.bestMomentTimestamp}. Keep the subject, pose, and scene recognizable. Edit ON TOP of this frame: add bold text overlays, stickers, arrows, emoji-style graphics, color grading, and viral thumbnail polish — do NOT replace with unrelated stock art.`
    : 'Create a viral click-worthy thumbnail based on this analyzed clip moment.'

  return [
    frameBlock,
    `Target: ${PLATFORM_LABELS[platformId] || platformId} — ${aspect}.`,
    `Peak moment: ${analysis.bestMomentTimestamp}.`,
    `Subject: ${analysis.subjectDescription}`,
    `Hook energy: ${analysis.emotionalHook}`,
    analysis.onImageText.length
      ? `Paint this on-image text (spell exactly, huge Impact style): ${analysis.onImageText.map((t) => `"${t}"`).join(', ')}`
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
  platformId: string,
  options?: ThumbnailPromptOptions
): string {
  const videoBlock = formatVideoAnalysisForThumbnailPrompt(analysis, platformId, options)
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
    process.env.THUMBNAIL_VIDEO_GEMINI_MODEL?.trim() ||
    process.env.THUMBNAIL_GEMINI_MODEL?.trim() ||
    THUMBNAIL_VIDEO_MODEL_DEFAULT

  const uploaded = await uploadBufferToGeminiFilesApi({
    apiKey,
    buffer,
    mimeType: normalizeMimeType(params.mimeType),
    displayName: 'thumbnail-reference-clip',
  })

  const cleanupName = uploaded.name
  await pollGeminiFileUntilActive(apiKey, uploaded.uri, { maxRetries: 60, retryDelayMs: 2000 })

  const { block: algoContext } = await formatThumbnailAlgorithmContextForPlatform(
    params.platformId
  )
  const durationNote =
    typeof params.durationSeconds === 'number' && params.durationSeconds > 0
      ? `Clip duration: ~${Math.round(params.durationSeconds / 60)} minutes (${params.durationSeconds}s). Sample key peaks across the FULL timeline — do not only watch the first minute.`
      : 'Scan the full clip for the single best thumbnail-worthy moment.'

  const prompt = buildViralClipAnalyzePrompt({
    platformId: params.platformId,
    algoContext,
    durationNote,
  })

  try {
    const genAI = new GoogleGenAI({ apiKey })
    let response
    try {
      response = await genAI.models.generateContent({
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
        config: {
          temperature: 0.4,
          maxOutputTokens: 1200,
          thinkingConfig: { thinkingBudget: 0 },
        } as {
          temperature?: number
          maxOutputTokens?: number
          thinkingConfig?: { thinkingBudget?: number }
        },
      })
    } catch {
      response = await genAI.models.generateContent({
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
        config: { temperature: 0.4, maxOutputTokens: 1200 },
      })
    }

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
    estimatedCostNote: `Gemini video analysis (~${minutes.toFixed(1)} min @ ~$${perMin}/min est.)`,
  }
}
