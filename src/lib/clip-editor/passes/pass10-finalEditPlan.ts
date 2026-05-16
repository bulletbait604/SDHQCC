import { finalEditPlanSchema } from '@/lib/clip-editor/schemas'
import type {
  BrollPlan,
  CaptionTimeline,
  ClipLayoutTemplate,
  CutRanking,
  FinalEditPlan,
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
}): FinalEditPlan {
  const primary = params.ranking.segments[0]
  const cuts = params.ranking.segments.slice(0, 4).map((seg) => ({
    start: seg.start,
    end: seg.end,
    trimStart: seg.start,
  }))

  if (!cuts.length) {
    cuts.push({ start: 0, end: Math.max(primary?.end || 30, 10), trimStart: 0 })
  }

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
