import { geminiJsonPass } from '@/lib/clip-editor/services/gemini'
import { geminiVideoPlanSchema } from '@/lib/clip-editor/schemas'
import { normalizeGeminiVideoPlan, preprocessGeminiVideoRaw } from '@/lib/clip-editor/normalizePlans'
import type { ClipEditorPlatform, ClipLayoutTemplate, GeminiVideoPlan } from '@/lib/clip-editor/types'
import { readAlgorithmSnapshotFromMongo } from '@/lib/algorithmSnapshotRead'
import { resolveClipEditorAlgorithmNotes } from '@/lib/clipEditorAlgorithmNotes'
import { platformClipEditorDirective, platformSafeZoneOffsets } from '@/lib/platformEditing'
import { excerptMinMaxSeconds } from '@/lib/clip-editor/excerptBounds'
import { getFileFromR2 } from '@/lib/r2'
import {
  deleteGeminiUploadedFile,
  pollGeminiFileUntilActive,
  uploadBufferToGeminiFilesApi,
} from '@/lib/geminiFiles'

function normalizeVideoMimeType(mimeType: string): string {
  const m = (mimeType || '').trim().toLowerCase()
  if (!m || m === 'application/octet-stream') return 'video/mp4'
  if (m.startsWith('video/')) return m
  return 'video/mp4'
}

async function uploadClipToGeminiFiles(params: {
  r2FileKey: string
  mimeType: string
}): Promise<{ uri: string; name: string }> {
  const apiKey = (process.env.GEMINI_API || '').trim()
  if (!apiKey) throw new Error('GEMINI_API is not configured')
  const buffer = await getFileFromR2(params.r2FileKey)
  if (!buffer) throw new Error('Could not load clip for Gemini video analysis')
  const uploaded = await uploadBufferToGeminiFilesApi({
    apiKey,
    buffer,
    mimeType: params.mimeType,
    displayName: 'clip-editor-source.mp4',
  })
  await pollGeminiFileUntilActive(apiKey, uploaded.uri, { maxRetries: 45, retryDelayMs: 2000 })
  return uploaded
}

export async function runGeminiVideoAnalysisPass(params: {
  sourceReadUrl: string
  r2FileKey: string
  mimeType: string
  platform: ClipEditorPlatform
  layoutTemplate: ClipLayoutTemplate
  durationSeconds: number
  transcriptExcerpt: string
}): Promise<GeminiVideoPlan> {
  const snapshot = await readAlgorithmSnapshotFromMongo()
  const algorithmNotes = resolveClipEditorAlgorithmNotes(snapshot, params.platform)
  const safeZone = platformSafeZoneOffsets(params.platform)
  const excerptBounds = excerptMinMaxSeconds(params.platform, params.durationSeconds)
  const mimeType = normalizeVideoMimeType(params.mimeType)

  // Always use Gemini Files API — presigned R2 URLs frequently cause HTTP 400 from generateContent.
  const uploaded = await uploadClipToGeminiFiles({
    r2FileKey: params.r2FileKey,
    mimeType,
  })
  const cleanupGeminiName = uploaded.name
  const geminiFileUri = uploaded.uri

  const prompt = `You are a viral media data scientist and short-form editor (OpusClip / StreamLadder quality). Watch this video directly.

Target platform: ${params.platform}
Platform directive: ${platformClipEditorDirective(params.platform)}
Excerpt length target: ${excerptBounds.min}–${excerptBounds.max}s (ideal ${excerptBounds.ideal}s)
Safe zone: ${JSON.stringify(safeZone)}
Requested layout: ${params.layoutTemplate}
Source duration (seconds): ${params.durationSeconds.toFixed(1)}

Algorithm notes:
${JSON.stringify(algorithmNotes)}

Transcript excerpt (for alignment — verify against what you see):
${params.transcriptExcerpt.slice(0, 6000)}

Return valid JSON only (no markdown fences):
{
  "hookTitle": "max 8 words, scroll-stopping, grounded in what happens on screen",
  "hookSubtitle": "optional max 10 words",
  "hookPlan": "why the opening hook works",
  "pacePlan": "cut density and energy for ${params.platform}",
  "contentType": "gameplayStream|talkingHead|sportsAction|screenShare|unknown",
  "layoutTemplate": "auto|fullFrame|stackedFacecam|pictureInPicture|splitScreen|focusCrop",
  "cutSeconds": 1.5-3.5,
  "introHookSeconds": 1.5-2.5,
  "renderSeconds": ${excerptBounds.min}-${excerptBounds.max},
  "captionStyle": "karaoke|bold|clean",
  "hookStyle": "pop|glitch|clean|urgent",
  "keywordHighlights": ["3-8 spoken words to emphasize in captions"],
  "viralSegments": [
    {
      "start_time": number,
      "end_time": number,
      "title": "short hook title",
      "explanation": "why this moment will perform",
      "virality_score": 1-100
    }
  ],
  "primaryWindow": {
    "start": number,
    "end": number,
    "confidence": 0-1,
    "reason": "why this continuous excerpt is the best short"
  },
  "regions": {
    "gameplay": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1, "confidence": 0-1 },
    "facecam": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1, "confidence": 0-1 },
    "speaker": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1, "confidence": 0-1 },
    "action": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1, "confidence": 0-1 }
  }
}

Rules:
- Identify 3 to 7 highly engaging segments with strong initial hooks in viralSegments.
- Each viralSegments entry must be ${excerptBounds.min}-${excerptBounds.max} seconds with start_time/end_time in source seconds (0 to ${params.durationSeconds.toFixed(1)}).
- Rank segments by virality_score (1-100); highest score first.
- primaryWindow must match your single best viralSegments entry (same start/end).
- Prefer ONE continuous excerpt for the short — do not plan jump-cut montages across unrelated timestamps.
- Use exact source timestamps in seconds. Do not invent moments not in the video.
- hookTitle and hookPlan are required strings.`

  try {
    const raw = await geminiJsonPass(geminiVideoPlanSchema, prompt, {
      videoFileUri: geminiFileUri,
      mimeType,
      allowOpenAiFallback: false,
      preprocess: (parsed) =>
        preprocessGeminiVideoRaw(parsed, params.durationSeconds, params.platform),
    })
    return normalizeGeminiVideoPlan(raw, params.durationSeconds, params.platform)
  } finally {
    const apiKey = (process.env.GEMINI_API || '').trim()
    if (apiKey) {
      await deleteGeminiUploadedFile(apiKey, cleanupGeminiName).catch(() => undefined)
    }
  }
}
