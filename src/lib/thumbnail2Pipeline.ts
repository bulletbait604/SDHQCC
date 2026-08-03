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
import { formatThumbnailAlgorithmContextForPlatform } from '@/lib/algorithmContext'
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

  const { block: algoContext } = await formatThumbnailAlgorithmContextForPlatform(
    params.platformId
  )
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

ALGORITHM FIRST: Your frame choice, emotionalHook, onImageText, and viralThumbnailBrief MUST reflect the cached ${label} algorithm data above (especially hook/title patterns and visual retention signals). algorithmAlignment must cite 1–2 concrete lines from that snapshot — not generic advice.

FRAME SELECTION (pick ONE timestamp — a real screenshot will be extracted, so the emotion must already be in-frame):
Priority order — choose the highest that actually appears in the clip AND matches algorithm CTR patterns:
1) Clear human REACTION face of someone who is IN the clip (shock, fear, disbelief, rage, hype) — mouth/eyes readable
2) Intense clutch / danger peak with that same real person visible
3) On-screen warnings, alerts, death screens, red UI, big damage numbers already present
4) High-contrast action of existing subjects (never invent new people)

Hard bans for frame choice:
- Do NOT pick a bland idle / menu / walking / "lost wandering" frame if a stronger reaction or warning UI exists
- Prefer mid/late peaks over the first 10 seconds unless that is truly the best reaction
- The moment must create a curiosity gap a scroller would click — confuse/lost vibes alone are weak unless paired with danger or a readable face reaction
- subjectDescription must name only people/objects visibly in that frame

OVERLAY BRIEF RULES (viralThumbnailBrief — stickers ONLY, but LOUD):
- A zoomed screenshot + title alone is a FAIL. Brief must specify a full viral sticker pack:
  1) 1–2 huge outlined ALL-CAPS hooks
  2) at least ONE big emoji sticker matching the emotion (😱 😳 💀 🔥 😮 etc.)
  3) at least ONE thick arrow pointing at the face or danger UI
  4) at least ONE bright circle/oval around the key subject or warning
  5) optional: sparkles / bang / "!" badges / neon underlines
- Forbidden: inventing people, faces, stock cutouts, new enemies, NPCs, weapons, game props, environment changes
- If a reaction inset helps CTR, DUPLICATE/CROP the creator face from THIS frame only
- Keep the brief punchy (max ~100 words). No self-critique. No "I will regenerate" language.

Viral text rules:
- onImageText: exactly 2 SHORT punchy hooks (3–6 words each), ALL-CAPS, high-stakes / curiosity / specificity
- Pattern wording after cached title/hook tips — ban soft filler ("I'M SO LOST", "WATCH THIS") unless the peak literally is that joke
- No duplicate lines

Return bestMomentTimestamp as MM:SS or H:MM:SS.

Return valid JSON only (no markdown):
{
  "bestMomentTimestamp": "e.g. 1:12:34 or 12:34 or 0:45",
  "subjectDescription": "who/what is visibly in that frame (real clip subject only)",
  "emotionalHook": "the scroll-stopping feeling already visible in-frame",
  "onImageText": ["HOOK ONE", "HOOK TWO"],
  "colorPalette": "high-contrast viral colors + mood",
  "compositionNotes": "where BIG text + emoji + arrow + circle go for ${vertical ? '9:16' : '16:9'} without covering the face",
  "viralThumbnailBrief": "Loud sticker pack art direction (emoji+arrow+circle+Impact text) aligned to algorithm CTR (100 words max)",
  "algorithmAlignment": "Cite cached ${label} snapshot lines this thumb follows"
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

  const { block: algoContext } = await formatThumbnailAlgorithmContextForPlatform(
    params.platformId
  )
  const label = PLATFORM_LABELS[params.platformId] || params.platformId

  const basePrompt = mergeUserPromptWithVideoAnalysis(
    params.userPrompt || '',
    params.analysis,
    params.platformId,
    { clipFrameProvided: true, stickerOnlyOverlays: true }
  )

  const paintPrompt = `${basePrompt}

${algoContext}

VIRAL CTR MANDATE: This must look like a top ${label} clickbait thumbnail — chaotic sticker energy, not a quiet cropped screenshot with a caption. Follow the cached algorithm data for hook style. Paint each onImageText hook exactly once (no duplicates).

REQUIRED STICKER PACK (all of these must appear — missing any is a fail):
A) HUGE Impact / YouTube-thumbnail text with thick black/white outline + drop shadow (mobile-readable from arm's length)
B) At least one LARGE emoji sticker (😱 😳 💀 🔥 😮 or closest match to the emotionalHook) near the subject
C) At least one thick bright arrow pointing at the face OR the danger/warning UI already in frame
D) At least one bright circle/oval around the key face or threat marker already in frame
E) Punchy grade: boost contrast/saturation, slight vignette OK — still keep the real scene recognizable

CRITICAL PAINT RULES (these OVERRIDE the viral brief and any creator overrides if they conflict):
1) The attached image is the ONLY source of people and scene content. Keep faces, bodies, enemies, UI, and environment recognizable — do not redraw or replace them.
2) OVERLAYS ONLY — pile on flat graphics (text, emoji stickers, arrows, circles, sparkles, bang/"!" badges). A title-only or zoom-only edit is NOT enough.
3) NEVER invent or paste a new person, random woman/man face, stock reaction face, influencer cutout, or any face not clearly taken from the attached frame.
4) If you add a reaction-face inset, it MUST be a crop/duplicate of a person already visible in THIS frame. Prefer circle+arrow on their existing face.
5) NEVER add new game characters, enemies, monsters, weapons, props, blood FX, or environment objects that are not already in the frame.
6) Do not restage the gameplay — no new threats, NPCs, or background swaps.
7) Keep big text high enough to clear platform UI chrome; do not bury the face under text.
8) OUTPUT IMAGE ONLY — no critiques, checklists, regeneration plans, or explanations.`

  const genAI = new GoogleGenAI({ apiKey })
  const candidates = [
    imageModel,
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.0-flash-exp-image-generation',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i)

  const contents = [
    {
      role: 'user' as const,
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
  ]

  let lastError: unknown
  for (const model of candidates) {
    for (const modalities of [[Modality.IMAGE], [Modality.TEXT, Modality.IMAGE]] as const) {
      try {
        const response = await genAI.models.generateContent({
          model,
          contents,
          config: {
            responseModalities: [...modalities],
          },
        })

        const parts = response.candidates?.[0]?.content?.parts ?? []
        const imagePart = parts.find((p) =>
          (p as { inlineData?: { mimeType?: string } })?.inlineData?.mimeType?.startsWith?.(
            'image/'
          )
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

        return {
          key,
          mimeType: contentType,
          description: 'Thumbnail 2.0',
          model,
        }
      } catch (error) {
        lastError = error
        console.warn(
          `[Thumbnail2] Image model ${model} modalities=${modalities.join('+')} failed:`,
          error
        )
      }
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
