import { applyStreamLadderStyleBlueprint, generateShotstackJSON } from '@/lib/generateShotstackJSON'
import { platformSafeZoneOffsets, type TargetPlatform } from '@/lib/platformEditing'
import { buildPrimaryClipWindow } from '@/lib/clip-editor/primaryClipWindow'
import type { FinalEditPlan, GeminiVideoPlan, TranscriptAnalysis } from '@/lib/clip-editor/types'
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
  geminiVideo?: GeminiVideoPlan
  sourceDurationSeconds?: number
  richCaptionUrl?: string
}): ShotstackRenderPayload {
  const platform = mapPlatform(params.platform)
  const safeZone = platformSafeZoneOffsets(platform)
  const duration = params.sourceDurationSeconds ?? params.transcript.durationSeconds
  const gemini = params.geminiVideo

  const ranking = { segments: params.editPlan.rankedSegments }
  const window = buildPrimaryClipWindow(ranking, duration, gemini)
  const clipLen = window.end - window.start

  const hookText =
    gemini?.hookTitle?.trim() ||
    params.editPlan.hook[0]?.text?.trim() ||
    params.transcript.words
      .slice(0, 12)
      .map((w) => w.word)
      .join(' ')
      .slice(0, 48) ||
    'watch this'

  const layoutTemplate =
    gemini?.layoutTemplate && gemini.layoutTemplate !== 'auto'
      ? gemini.layoutTemplate
      : params.editPlan.layoutTemplate

  const sourceMoments = [
    {
      startSeconds: window.start,
      endSeconds: window.end,
      role: 'hook' as const,
      reason: gemini?.primaryWindow?.reason || 'primary ranked moment',
      visualTreatment: 'slowZoomIn' as const,
    },
  ]

  const wordsInWindow = params.transcript.words.filter(
    (w) => w.end >= window.start && w.start <= window.end
  )

  const blueprint = {
    cutSeconds: gemini?.cutSeconds ?? (platform === 'tiktok' ? 2.1 : 2.6),
    introHookSeconds: gemini?.introHookSeconds ?? 2,
    renderSeconds: Math.min(
      45,
      Math.max(12, gemini?.renderSeconds ?? clipLen)
    ),
    captionWordsPerChunk: 4,
    contentType: gemini?.contentType ?? ('unknown' as const),
    layoutTemplate,
    regions: gemini?.regions,
    hookTitle: hookText.slice(0, 42),
    hookSubtitle: gemini?.hookSubtitle?.slice(0, 56) || '',
    hookStyle: gemini?.hookStyle ?? ('clean' as const),
    captionStyle: gemini?.captionStyle ?? ('bold' as const),
    richCaptionUrl: params.richCaptionUrl,
    keywordHighlights: gemini?.keywordHighlights?.slice(0, 12) ?? [],
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
    hookPlan: gemini?.hookPlan || hookText,
    pacePlan: gemini?.pacePlan,
    editBlueprint: styled,
    transcriptWords: wordsInWindow.map((w) => ({
      start: w.start,
      end: w.end,
      word: w.word,
      punctuated_word: w.word,
    })),
    sourceDurationSeconds: duration,
  })

  const output =
    shotstack.output && typeof shotstack.output === 'object'
      ? (shotstack.output as Record<string, unknown>)
      : defaultShotstackOutput()

  return {
    timeline: shotstack.timeline as Record<string, unknown>,
    output,
    metadata: shotstack.metadata as Record<string, unknown> | undefined,
  }
}
