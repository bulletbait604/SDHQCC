export const CLIP_EDITOR_JOB_STATES = [
  'UPLOADED',
  'TRANSCRIBING',
  'HOOK_ANALYSIS',
  'RETENTION_ANALYSIS',
  'CUT_RANKING',
  'PACING',
  'REFRAMING',
  'CAPTIONING',
  'EDIT_PLAN',
  'RENDERING',
  'COMPLETE',
  'FAILED',
] as const

export type ClipEditorJobState = (typeof CLIP_EDITOR_JOB_STATES)[number]

export const CLIP_EDITOR_STATE_PROGRESS: Record<ClipEditorJobState, number> = {
  UPLOADED: 5,
  TRANSCRIBING: 12,
  HOOK_ANALYSIS: 22,
  RETENTION_ANALYSIS: 32,
  CUT_RANKING: 42,
  PACING: 52,
  REFRAMING: 60,
  CAPTIONING: 68,
  EDIT_PLAN: 76,
  RENDERING: 88,
  COMPLETE: 100,
  FAILED: 0,
}

export const CLIP_EDITOR_STATE_LABELS: Record<ClipEditorJobState, string> = {
  UPLOADED: 'Queued',
  TRANSCRIBING: 'Transcribing speech',
  HOOK_ANALYSIS: 'Finding hooks',
  RETENTION_ANALYSIS: 'Predicting retention',
  CUT_RANKING: 'Ranking best segments',
  PACING: 'Planning pacing',
  REFRAMING: 'Planning vertical crop',
  CAPTIONING: 'Building captions',
  EDIT_PLAN: 'Finalizing edit plan',
  RENDERING: 'Rendering video',
  COMPLETE: 'Complete',
  FAILED: 'Failed',
}
