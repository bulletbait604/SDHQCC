import { applyStreamLadderStyleBlueprint, generateShotstackJSON } from '@/lib/generateShotstackJSON'
import { platformSafeZoneOffsets, type TargetPlatform } from '@/lib/platformEditing'
import { buildPrimaryClipWindow } from '@/lib/clip-editor/primaryClipWindow'
import type { FinalEditPlan, TranscriptAnalysis } from '@/lib/clip-editor/types'
import type { ShotstackRenderPayload } from '@/lib/clip-editor/services/shotstack'
import { defaultShotstackOutput } from '@/lib/clip-editor/services/shotstack'

function mapPlatform(platform: string): TargetPlatform {
  if (platform === 'youtube' || platform === 'reels') return platform
  return 'tiktok'
}

export function buildShotstackPackageFromEditPlan(params: {
  sourceUrl: string
  platform: string
  editPlan: FinalEditPlan
  transcript: TranscriptAnalysis
  sourceDurationSeconds?: number
  richCaptionUrl?: string
}): ShotstackRenderPayload {
  const platform = mapPlatform(params.platform)
  const safeZone = platformSafeZoneOffsets(platform)
  const duration = params.sourceDurationSeconds ?? params.transcript.durationSeconds

  const ranking = { segments: params.editPlan.rankedSegments }
  const window = buildPrimaryClipWindow(ranking, duration)
  const clipLen = window.end - window.start

  const hookText =
    params.editPlan.hook[0]?.text?.trim() ||
    params.transcript.words
      .slice(0, 12)
      .map((w) => w.word)
      .join(' ')
      .slice(0, 48) ||
    'watch this'

  const sourceMoments = [
    {
      startSeconds: window.start,
      endSeconds: window.end,
      role: 'hook' as const,
      reason: 'primary ranked moment',
      visualTreatment: 'slowZoomIn' as const,
    },
  ]

  const wordsInWindow = params.transcript.words.filter(
    (w) => w.end >= window.start && w.start <= window.end
  )

  const blueprint = {
    cutSeconds: platform === 'tiktok' ? 2.1 : 2.6,
    introHookSeconds: 2,
    renderSeconds: Math.min(45, Math.max(12, clipLen)),
    captionWordsPerChunk: 4,
    contentType: 'unknown' as const,
    layoutTemplate: params.editPlan.layoutTemplate,
    hookTitle: hookText.slice(0, 42),
    hookSubtitle: '',
    hookStyle: 'clean' as const,
    captionStyle: 'bold' as const,
    richCaptionUrl: params.richCaptionUrl,
    keywordHighlights: [],
    sourceMoments,
    textOverlays: [],
    stickerOverlays: [],
    preferredTransitions: ['fadeFast', 'fade'],
    subtitles: [],
  }

  const styled =
    applyStreamLadderStyleBlueprint(platform, duration, blueprint) ?? blueprint

  const shotstack = generateShotstackJSON({
    sourceUrl: params.sourceUrl,
    platform,
    safeZone,
    landscapeMode: params.editPlan.landscapeMode,
    hookPlan: hookText,
    editBlueprint: styled,
    transcriptWords: wordsInWindow.map((w) => ({
      start: w.start,
      end: w.end,
      word: w.word,
      punctuated_word: w.word,
    })),
    sourceDurationSeconds: duration,
  })

  return {
    timeline: shotstack.timeline as Record<string, unknown>,
    output: defaultShotstackOutput(),
    metadata: shotstack.metadata as Record<string, unknown> | undefined,
  }
}
