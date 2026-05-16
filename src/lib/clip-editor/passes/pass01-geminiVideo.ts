import { geminiJsonPass } from '@/lib/clip-editor/services/gemini'
import { geminiVideoPlanSchema } from '@/lib/clip-editor/schemas'
import type { ClipEditorPlatform, ClipLayoutTemplate, GeminiVideoPlan } from '@/lib/clip-editor/types'
import { readAlgorithmSnapshotFromMongo } from '@/lib/algorithmSnapshotRead'
import { resolveClipEditorAlgorithmNotes } from '@/lib/clipEditorAlgorithmNotes'
import { platformEditingDirective, platformSafeZoneOffsets } from '@/lib/platformEditing'
import { getFileFromR2, getR2ObjectMetadata } from '@/lib/r2'
import {
  deleteGeminiUploadedFile,
  pollGeminiFileUntilActive,
  uploadBufferToGeminiFilesApi,
} from '@/lib/geminiFiles'

const GEMINI_EXTERNAL_URL_MAX_BYTES = 100 * 1024 * 1024

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

  let geminiFileUri = params.sourceReadUrl
  let cleanupGeminiName: string | null = null

  const meta = await getR2ObjectMetadata(params.r2FileKey)
  if (meta && meta.contentLength > GEMINI_EXTERNAL_URL_MAX_BYTES) {
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
    cleanupGeminiName = uploaded.name
    await pollGeminiFileUntilActive(apiKey, uploaded.uri)
    geminiFileUri = uploaded.uri
  }

  const prompt = `You are a viral short-form editor (OpusClip / StreamLadder quality). Watch this video directly.

Target platform: ${params.platform}
Platform directive: ${platformEditingDirective(params.platform)}
Safe zone: ${JSON.stringify(safeZone)}
Requested layout: ${params.layoutTemplate}
Source duration (seconds): ${params.durationSeconds.toFixed(1)}

Algorithm notes:
${JSON.stringify(algorithmNotes)}

Transcript excerpt (for alignment — verify against what you see):
${params.transcriptExcerpt.slice(0, 6000)}

Return JSON only:
{
  "hookTitle": "max 8 words, scroll-stopping, grounded in what happens on screen",
  "hookSubtitle": "optional max 10 words",
  "hookPlan": "why the opening hook works",
  "pacePlan": "cut density and energy for ${params.platform}",
  "contentType": "gameplayStream|talkingHead|sportsAction|screenShare|unknown",
  "layoutTemplate": "auto|fullFrame|stackedFacecam|pictureInPicture|splitScreen|focusCrop",
  "cutSeconds": 1.5-3.5,
  "introHookSeconds": 1.5-2.5,
  "renderSeconds": 12-38,
  "captionStyle": "karaoke|bold|clean",
  "hookStyle": "pop|glitch|clean|urgent",
  "keywordHighlights": ["3-8 spoken words to emphasize in captions"],
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
- primaryWindow must be ONE continuous excerpt (12-38s) with the strongest hook at the start of that window.
- Use exact source timestamps in seconds.
- Pick layoutTemplate from what you see (stackedFacecam for facecam+gameplay, focusCrop for talking head, etc.).
- Do not invent moments not in the video.
- renderSeconds should match primaryWindow length (capped at 38).`

  try {
    return await geminiJsonPass(geminiVideoPlanSchema, prompt, {
      videoFileUri: geminiFileUri,
      mimeType: params.mimeType,
    })
  } finally {
    if (cleanupGeminiName) {
      const apiKey = (process.env.GEMINI_API || '').trim()
      if (apiKey) {
        await deleteGeminiUploadedFile(apiKey, cleanupGeminiName).catch(() => undefined)
      }
    }
  }
}
