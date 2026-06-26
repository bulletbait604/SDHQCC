import { applyStreamLadderStyleBlueprint, generateShotstackJSON } from '@/lib/generateShotstackJSON'
import { platformSafeZoneOffsets, type TargetPlatform } from '@/lib/platformEditing'
import { buildPrimaryClipWindow } from '@/lib/clip-editor/primaryClipWindow'
import { clampRenderSeconds } from '@/lib/clip-editor/excerptBounds'
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
  const window = buildPrimaryClipWindow(ranking, duration, gemini, platform)
  const clipLen = window.end - window.start
  const excerptSeconds = clampRenderSeconds(clipLen, platform, duration)

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
    continuousExcerpt: true,
    cutSeconds: excerptSeconds,
    introHookSeconds: Math.min(2.5, excerptSeconds * 0.12),
    renderSeconds: excerptSeconds,
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
    preferredTransitions: ['fade'],
    subtitles: [],
    brollOverlays: params.editPlan.broll
      .filter((p) => typeof p.assetUrl === 'string' && p.assetUrl.length > 0)
      .map((p) => ({
        assetUrl: p.assetUrl as string,
        timelineStartSeconds: Math.max(0, p.start - window.start),
        durationSeconds: Math.min(Math.max(0.8, p.end - p.start), 3.5),
      })),
  }

  const styled =
    applyStreamLadderStyleBlueprint(platform, window.end, blueprint) ?? blueprint

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
    sourceDurationSeconds: window.end,
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
