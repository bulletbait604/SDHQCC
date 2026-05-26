export const CLIP_EDITOR_JOB_STATES = [
  'UPLOADED',
  'TRANSCRIBING',
  'VIDEO_ANALYSIS',
  'HOOK_ANALYSIS',
  'RETENTION_ANALYSIS',
  'CUT_RANKING',
  'REFRAMING',
  'VIRALITY_CUT',
  'RENDERING_CUT_PREVIEW',
  'CUT_PHASE_DONE',
  'PACING',
  'BROLL_PLANNING',
  'VIRALITY_EFFECTS',
  'RENDERING_EFFECTS_PREVIEW',
  'EFFECTS_PHASE_DONE',
  'TEXT_TRANSCRIBING',
  'CAPTIONING',
  'EDIT_PLAN',
  'RENDERING',
  'COMPLETE',
  'FAILED',
] as const

/** User-facing wizard step (independent of internal pipeline state). */
export const CLIP_EDITOR_USER_PHASES = [
  'ready',
  'cut_running',
  'cut_ready',
  'finish_running',
  'complete',
  'failed',
] as const

export type ClipEditorUserPhase = (typeof CLIP_EDITOR_USER_PHASES)[number]

export type ClipEditorJobState = (typeof CLIP_EDITOR_JOB_STATES)[number]

export const CLIP_EDITOR_STATE_PROGRESS: Record<ClipEditorJobState, number> = {
  UPLOADED: 4,
  TRANSCRIBING: 8,
  VIDEO_ANALYSIS: 14,
  HOOK_ANALYSIS: 20,
  RETENTION_ANALYSIS: 26,
  CUT_RANKING: 32,
  REFRAMING: 38,
  VIRALITY_CUT: 42,
  RENDERING_CUT_PREVIEW: 47,
  CUT_PHASE_DONE: 50,
  PACING: 54,
  BROLL_PLANNING: 60,
  VIRALITY_EFFECTS: 64,
  RENDERING_EFFECTS_PREVIEW: 68,
  EFFECTS_PHASE_DONE: 72,
  TEXT_TRANSCRIBING: 76,
  CAPTIONING: 82,
  EDIT_PLAN: 88,
  RENDERING: 94,
  COMPLETE: 100,
  FAILED: 0,
}

export const CLIP_EDITOR_STATE_LABELS: Record<ClipEditorJobState, string> = {
  UPLOADED: 'Queued',
  TRANSCRIBING: 'Transcribing speech (Deepgram)',
  VIDEO_ANALYSIS: 'Analyzing video (Gemini)',
  HOOK_ANALYSIS: 'Finding hooks (Gemini)',
  RETENTION_ANALYSIS: 'Predicting retention (Gemini)',
  CUT_RANKING: 'Ranking best segments',
  REFRAMING: 'Planning vertical crop & layout',
  VIRALITY_CUT: 'Virality check — cut pass',
  RENDERING_CUT_PREVIEW: 'Rendering cut preview (Shotstack)',
  CUT_PHASE_DONE: 'Cut preview ready',
  PACING: 'Planning zooms & transitions (Gemini)',
  BROLL_PLANNING: 'Planning motion & effects',
  VIRALITY_EFFECTS: 'Virality check — effects pass',
  RENDERING_EFFECTS_PREVIEW: 'Rendering effects preview (Shotstack)',
  EFFECTS_PHASE_DONE: 'Effects preview ready',
  TEXT_TRANSCRIBING: 'Re-analyzing audio for captions',
  CAPTIONING: 'Building text overlays (Gemini)',
  EDIT_PLAN: 'Finalizing edit plan',
  RENDERING: 'Rendering video (Shotstack)',
  COMPLETE: 'Complete',
  FAILED: 'Failed',
}

export function userPhaseFromJobState(state: ClipEditorJobState): ClipEditorUserPhase {
  if (state === 'FAILED') return 'failed'
  if (state === 'COMPLETE') return 'complete'
  if (
    state === 'UPLOADED' ||
    state === 'TRANSCRIBING' ||
    state === 'VIDEO_ANALYSIS' ||
    state === 'HOOK_ANALYSIS' ||
    state === 'RETENTION_ANALYSIS' ||
    state === 'CUT_RANKING' ||
    state === 'REFRAMING' ||
    state === 'VIRALITY_CUT' ||
    state === 'RENDERING_CUT_PREVIEW'
  ) {
    return 'cut_running'
  }
  if (state === 'CUT_PHASE_DONE') return 'cut_ready'
  if (
    state === 'PACING' ||
    state === 'BROLL_PLANNING' ||
    state === 'VIRALITY_EFFECTS' ||
    state === 'RENDERING_EFFECTS_PREVIEW' ||
    state === 'EFFECTS_PHASE_DONE' ||
    state === 'TEXT_TRANSCRIBING' ||
    state === 'CAPTIONING' ||
    state === 'EDIT_PLAN' ||
    state === 'RENDERING'
  ) {
    return 'finish_running'
  }
  return 'ready'
}
