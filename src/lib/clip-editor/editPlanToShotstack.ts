import { applyStreamLadderStyleBlueprint, generateShotstackJSON } from '@/lib/generateShotstackJSON'
import { platformSafeZoneOffsets, type TargetPlatform } from '@/lib/platformEditing'
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
}): ShotstackRenderPayload {
  const platform = mapPlatform(params.platform)
  const safeZone = platformSafeZoneOffsets(platform)
  const primary = params.editPlan.rankedSegments[0]
  const hookText = params.editPlan.hook[0]?.text || 'wait for it'

  const sourceMoments = params.editPlan.cuts.map((cut, index) => ({
    startSeconds: cut.start,
    endSeconds: cut.end,
    role: index === 0 ? ('hook' as const) : ('escalation' as const),
    reason: 'ranked segment',
    visualTreatment: params.editPlan.zooms.some((z) => z.atSeconds >= cut.start && z.atSeconds <= cut.end)
      ? ('slowZoomIn' as const)
      : ('none' as const),
  }))

  const textOverlays = [
    ...params.editPlan.hook.map((h) => ({
      text: h.text,
      timelineStartSeconds: h.start,
      durationSeconds: Math.max(0.5, h.end - h.start),
      position: 'top' as const,
      type: 'callout' as const,
    })),
    ...params.editPlan.captions
      .filter((c) => c.emphasis)
      .slice(0, 8)
      .map((c) => ({
        text: c.text,
        timelineStartSeconds: c.start,
        durationSeconds: Math.max(0.35, c.end - c.start),
        position: 'middle' as const,
        type: 'callout' as const,
      })),
  ]

  const stickerOverlays = params.editPlan.stickers.map((s) => ({
    text: s.text,
    timelineStartSeconds: s.atSeconds,
    durationSeconds: s.durationSeconds,
    position: s.position as
      | 'topLeft'
      | 'topRight'
      | 'bottomLeft'
      | 'bottomRight'
      | 'middleLeft'
      | 'middleRight',
  }))

  const blueprint = {
    cutSeconds: 1.6,
    introHookSeconds: 2,
    renderSeconds: Math.min(
      60,
      Math.max(8, (primary?.end || params.transcript.durationSeconds) - (primary?.start || 0))
    ),
    captionWordsPerChunk: 3,
    contentType: 'gameplayStream' as const,
    layoutTemplate: params.editPlan.layoutTemplate,
    hookTitle: hookText.toUpperCase(),
    hookSubtitle: '',
    hookStyle: 'pop' as const,
    captionStyle: 'karaoke' as const,
    keywordHighlights: params.transcript.words
      .filter((w) => w.word === w.word.toUpperCase() && w.word.length > 2)
      .map((w) => w.word)
      .slice(0, 12),
    sourceMoments,
    textOverlays,
    stickerOverlays,
    preferredTransitions: ['fadeFast', 'zoom'],
    subtitles: params.editPlan.captions.map((c) => ({
      text: c.text,
      timelineStartSeconds: c.start,
      durationSeconds: Math.max(0.3, c.end - c.start),
      position: 'bottom' as const,
      type: 'subtitle' as const,
    })),
  }

  const styled =
    applyStreamLadderStyleBlueprint(
      platform,
      params.sourceDurationSeconds ?? params.transcript.durationSeconds,
      blueprint
    ) ?? blueprint

  const shotstack = generateShotstackJSON({
    sourceUrl: params.sourceUrl,
    platform,
    safeZone,
    landscapeMode: params.editPlan.landscapeMode,
    hookPlan: hookText,
    editBlueprint: styled,
    transcriptWords: params.transcript.words.map((w) => ({
      start: w.start,
      end: w.end,
      word: w.word,
      punctuated_word: w.word,
    })),
    sourceDurationSeconds: params.sourceDurationSeconds ?? params.transcript.durationSeconds,
  })

  return {
    timeline: shotstack.timeline as Record<string, unknown>,
    output: defaultShotstackOutput(),
  }
}
