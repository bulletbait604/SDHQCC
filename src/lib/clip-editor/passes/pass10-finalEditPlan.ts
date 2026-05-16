import { finalEditPlanSchema } from '@/lib/clip-editor/schemas'
import { buildPrimaryClipWindow } from '@/lib/clip-editor/primaryClipWindow'
import type {
  BrollPlan,
  CaptionTimeline,
  ClipLayoutTemplate,
  CutRanking,
  FinalEditPlan,
  GeminiVideoPlan,
  HookOverlayPlan,
  PacingPlan,
  ReframingPlan,
} from '@/lib/clip-editor/types'

export function runFinalEditPlanPass(params: {
  ranking: CutRanking
  pacing: PacingPlan
  captions: CaptionTimeline
  reframing: ReframingPlan
  hookOverlay: HookOverlayPlan
  broll: BrollPlan
  layoutTemplate: ClipLayoutTemplate
  landscapeMode: 'crop' | 'letterbox'
  durationSeconds: number
  geminiVideo?: GeminiVideoPlan
}): FinalEditPlan {
  const window = buildPrimaryClipWindow(params.ranking, params.durationSeconds, params.geminiVideo)
  const cuts = [
    {
      start: window.start,
      end: window.end,
      trimStart: window.start,
    },
  ]

  return finalEditPlanSchema.parse({
    cuts,
    zooms: params.pacing.zooms,
    captions: params.captions.cues,
    cropKeyframes: params.reframing.cropKeyframes,
    effects: params.pacing.effectTiming,
    stickers: [],
    hook: params.hookOverlay.overlays,
    broll: params.broll.enabled ? params.broll.placements : [],
    rankedSegments: params.ranking.segments,
    layoutTemplate: params.layoutTemplate,
    landscapeMode: params.landscapeMode,
  })
}
