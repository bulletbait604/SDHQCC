/**
 * Thumbnail 2.0 — viral thumb from a long clip (R&D / owner-only).
 * Models: Flash-Lite (video) → Flash Image (paint overlays on extracted frame).
 */
import { GoogleGenAI, Modality } from '@google/genai'
import { getFileFromR2, deleteFileFromR2, putBufferToR2 } from '@/lib/r2'
import {
  deleteGeminiUploadedFile,
  pollGeminiFileUntilActive,
  uploadBufferToGeminiFilesApi,
} from '@/lib/geminiFiles'
import { formatAlgorithmContextForPlatform } from '@/lib/algorithmContext'
import {
  parseThumbnailVideoAnalysisJson,
  type ThumbnailVideoAnalysis,
} from '@/lib/thumbnailVideoAnalysisSchema'
import {
  mergeUserPromptWithVideoAnalysis,
} from '@/lib/thumbnailVideoAnalysis'
import {
  THUMBNAIL2_CLIP_MAX_BYTES,
  THUMBNAIL2_IMAGE_MODEL_DEFAULT,
  THUMBNAIL2_VIDEO_MODEL_DEFAULT,
} from '@/lib/thumbnail2Limits'
import { randomUUID } from 'crypto'

const PLATFORM_LABELS: Record<string, string> = {
  'youtube-shorts': 'YouTube Shorts',
  'youtube-long': 'YouTube (long-form)',
  tiktok: 'TikTok',
  instagram: 'Instagram Reels',
  'facebook-reels': 'Facebook Reels',
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

export async function analyzeThumbnail2Clip(params: {
  r2FileKey: string
  mimeType: string
  platformId: string
  durationSeconds?: number
}): Promise<ThumbnailVideoAnalysis> {
  const apiKey = (process.env.GEMINI_API || '').trim()
  if (!apiKey) throw new Error('GEMINI_API is not configured')

  const buffer = await getFileFromR2(params.r2FileKey)
  if (!buffer) throw new Error('Clip not found in storage')
  if (buffer.length > THUMBNAIL2_CLIP_MAX_BYTES) {
    throw new Error('Clip exceeds maximum upload size')
  }

  const model =
    process.env.THUMBNAIL2_VIDEO_MODEL?.trim() ||
    process.env.THUMBNAIL_VIDEO_GEMINI_MODEL?.trim() ||
    THUMBNAIL2_VIDEO_MODEL_DEFAULT

  const uploaded = await uploadBufferToGeminiFilesApi({
    apiKey,
    buffer,
    mimeType: normalizeMimeType(params.mimeType),
    displayName: 'thumbnail2-clip',
  })

  const cleanupName = uploaded.name
  await pollGeminiFileUntilActive(apiKey, uploaded.uri, { maxRetries: 90, retryDelayMs: 2000 })

  const { block: algoContext } = await formatAlgorithmContextForPlatform(params.platformId)
  const vertical = isVerticalPlatform(params.platformId)
  const label = PLATFORM_LABELS[params.platformId] || params.platformId
  const durationNote =
    typeof params.durationSeconds === 'number' && params.durationSeconds > 0
      ? `Clip duration: ~${Math.round(params.durationSeconds / 60)} minutes (${params.durationSeconds}s). Sample key peaks across the FULL timeline — do not only watch the first minute.`
      : 'Scan the full clip for the single best thumbnail-worthy moment.'

  const prompt = `You are an elite viral thumbnail strategist for ${label}. Watch this reference clip.

Thumbnail format: ${vertical ? 'VERTICAL 9:16 (mobile short-form)' : 'Horizontal 16:9 click-magnet'}
${durationNote}

${algoContext}

Find the ONE peak moment that maximizes CTR on ${label}: face/reaction, action peak, contrast, curiosity gap.
Return bestMomentTimestamp as MM:SS or H:MM:SS — a frame will be extracted at that exact time.

Viral text rules:
- onImageText: 2–4 SHORT punchy hooks (3–6 words), ALL-CAPS where natural, platform-native slang OK
- Prefer curiosity / bold claim / specific moment — ban vague "WATCH THIS" filler
- viralThumbnailBrief: art direction for overlays, stickers, arrows, emoji bursts, bold Impact-style fonts on the frame

Return valid JSON only (no markdown):
{
  "bestMomentTimestamp": "e.g. 1:12:34 or 12:34 or 0:45",
  "subjectDescription": "who/what is the focal subject",
  "emotionalHook": "the scroll-stopping feeling",
  "onImageText": ["HOOK ONE", "HOOK TWO"],
  "colorPalette": "colors + mood",
  "compositionNotes": "subject/text placement for ${vertical ? '9:16' : '16:9'}",
  "viralThumbnailBrief": "Art direction: bold viral fonts, sticker/emoji accents, arrows, high contrast grade (130 words max)",
  "algorithmAlignment": "How this thumb fits ${label} discovery"
}`

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

export async function paintThumbnail2(params: {
  platformId: string
  analysis: ThumbnailVideoAnalysis
  imageBase64: string
  mimeType: string
  userPrompt?: string
  sessionId: string
}): Promise<{ key: string; mimeType: string; description: string; model: string }> {
  const apiKey = (process.env.GEMINI_API || '').trim()
  if (!apiKey) throw new Error('GEMINI_API is not configured')

  const imageModel =
    process.env.THUMBNAIL2_IMAGE_MODEL?.trim() ||
    process.env.THUMBNAIL_GEMINI_IMAGE_MODEL?.trim() ||
    THUMBNAIL2_IMAGE_MODEL_DEFAULT

  const basePrompt = mergeUserPromptWithVideoAnalysis(
    params.userPrompt || '',
    params.analysis,
    params.platformId,
    { clipFrameProvided: true }
  )

  const paintPrompt = `${basePrompt}

CRITICAL PAINT RULES:
- The attached image IS the exact clip frame. Keep subject/pose recognizable.
- ADD bold viral text overlays (use onImageText hooks), stickers, arrows, emoji-style pops, high-contrast grade.
- Use thick Impact / YouTube-thumbnail style fonts with outline/shadow so text pops on mobile.
- Do NOT replace the scene with unrelated stock art.
- Output ONE finished thumbnail image.`

  const genAI = new GoogleGenAI({ apiKey })
  const candidates = [
    imageModel,
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.0-flash-exp-image-generation',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i)

  let lastError: unknown
  for (const model of candidates) {
    try {
      const response = await genAI.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: params.imageBase64,
                  mimeType: params.mimeType || 'image/jpeg',
                },
              },
              { text: paintPrompt },
            ],
          },
        ],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      })

      const parts = response.candidates?.[0]?.content?.parts ?? []
      const imagePart = parts.find((p) =>
        (p as { inlineData?: { mimeType?: string } })?.inlineData?.mimeType?.startsWith?.('image/')
      ) as { inlineData?: { data?: string; mimeType?: string } } | undefined

      if (!imagePart?.inlineData?.data || !imagePart.inlineData.mimeType) {
        throw new Error('Gemini did not return an image')
      }

      const buffer = Buffer.from(imagePart.inlineData.data, 'base64')
      const contentType = imagePart.inlineData.mimeType
      const ext = contentType.includes('png')
        ? 'png'
        : contentType.includes('webp')
          ? 'webp'
          : 'jpg'
      const key = `thumbnails/${params.sessionId}/${randomUUID()}.${ext}`
      const ok = await putBufferToR2(key, buffer, contentType)
      if (!ok) throw new Error('Failed to store thumbnail in R2')

      const textPart = parts.find((p) => typeof (p as { text?: string }).text === 'string') as
        | { text?: string }
        | undefined

      return {
        key,
        mimeType: contentType,
        description: textPart?.text?.trim() || 'Thumbnail 2.0 viral frame edit',
        model,
      }
    } catch (error) {
      lastError = error
      console.warn(`[Thumbnail2] Image model ${model} failed:`, error)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Thumbnail 2.0 image generation failed')
}

export async function cleanupThumbnail2Clip(r2FileKey: string): Promise<void> {
  await deleteFileFromR2(r2FileKey).catch(() => undefined)
}

export function estimateThumbnail2Usd(durationSeconds: number): {
  estimatedCostUsd: number
  estimatedCostNote: string
} {
  const minutes = Math.max(0.5, durationSeconds / 60)
  const perMin = Number(process.env.ESTIMATE_THUMBNAIL2_VIDEO_USD_PER_MIN ?? '0.002')
  const paint = Number(process.env.ESTIMATE_THUMBNAIL2_PAINT_USD ?? '0.004')
  const usd = minutes * perMin + paint
  return {
    estimatedCostUsd: Math.round(usd * 100_000) / 100_000,
    estimatedCostNote: `Thumbnail 2.0: Flash-Lite video (~${minutes.toFixed(1)} min) + Flash Image paint`,
  }
}
