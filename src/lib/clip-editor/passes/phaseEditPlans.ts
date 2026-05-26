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

/** After Cut it — trims + vertical crop only (no effects or text). */
export function runCutPhaseEditPlanPass(params: {
  ranking: CutRanking
  reframing: ReframingPlan
  layoutTemplate: ClipLayoutTemplate
  landscapeMode: 'crop' | 'letterbox'
  durationSeconds: number
  geminiVideo?: GeminiVideoPlan
}): FinalEditPlan {
  const window = buildPrimaryClipWindow(params.ranking, params.durationSeconds, params.geminiVideo)
  return finalEditPlanSchema.parse({
    cuts: [{ start: window.start, end: window.end, trimStart: window.start }],
    zooms: [],
    captions: [],
    cropKeyframes: params.reframing.cropKeyframes,
    effects: [],
    stickers: [],
    hook: [],
    broll: [],
    rankedSegments: params.ranking.segments,
    layoutTemplate: params.layoutTemplate,
    landscapeMode: params.landscapeMode,
  })
}

/** After Effects — cuts + crop + zooms/transitions/b-roll (no captions yet). */
export function runEffectsPhaseEditPlanPass(params: {
  ranking: CutRanking
  pacing: PacingPlan
  reframing: ReframingPlan
  broll: BrollPlan
  layoutTemplate: ClipLayoutTemplate
  landscapeMode: 'crop' | 'letterbox'
  durationSeconds: number
  geminiVideo?: GeminiVideoPlan
}): FinalEditPlan {
  const window = buildPrimaryClipWindow(params.ranking, params.durationSeconds, params.geminiVideo)
  return finalEditPlanSchema.parse({
    cuts: [{ start: window.start, end: window.end, trimStart: window.start }],
    zooms: params.pacing.zooms,
    captions: [],
    cropKeyframes: params.reframing.cropKeyframes,
    effects: params.pacing.effectTiming,
    stickers: [],
    hook: [],
    broll: params.broll.enabled ? params.broll.placements : [],
    rankedSegments: params.ranking.segments,
    layoutTemplate: params.layoutTemplate,
    landscapeMode: params.landscapeMode,
  })
}

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
  return finalEditPlanSchema.parse({
    cuts: [{ start: window.start, end: window.end, trimStart: window.start }],
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
