import { reframingPlanSchema } from '@/lib/clip-editor/schemas'
import type { ClipLayoutTemplate, ReframingPlan, TranscriptAnalysis } from '@/lib/clip-editor/types'

export function runReframingPass(
  transcript: TranscriptAnalysis,
  layoutTemplate: ClipLayoutTemplate,
  landscapeMode: 'crop' | 'letterbox'
): ReframingPlan {
  const duration = transcript.durationSeconds
  const speakers = transcript.speakers.length
  const multipleFaces = speakers > 1
  const hasMovement = transcript.emotionSignals.length > 4 || transcript.toneShifts.length > 3

  const keyframes: ReframingPlan['cropKeyframes'] = []
  const steps = Math.max(3, Math.min(12, Math.ceil(duration / 2.5)))
  for (let i = 0; i < steps; i++) {
    const atSeconds = (duration / steps) * i
    const drift = hasMovement ? Math.sin(i * 0.7) * 0.04 : 0
    keyframes.push({
      atSeconds,
      x: clamp01(0.5 - 0.225 + drift),
      y: clamp01(landscapeMode === 'letterbox' ? 0.1 : 0.5 - 0.4 + drift * 0.5),
      width: 0.45,
      height: landscapeMode === 'letterbox' ? 0.8 : 0.8,
      confidence: multipleFaces ? 0.62 : 0.88,
    })
  }

  const smartCropConfidence = multipleFaces || hasMovement ? 0.55 : 0.9
  const trackingMode =
    layoutTemplate === 'focusCrop'
      ? 'face'
      : multipleFaces
        ? 'speaker'
        : hasMovement
          ? 'motion'
          : 'center'

  return reframingPlanSchema.parse({
    orientation: 'horizontal',
    multipleFaces,
    hasMovement,
    layoutTemplate,
    cropKeyframes: keyframes,
    trackingMode: smartCropConfidence < 0.7 ? trackingMode : 'center',
    smartCropConfidence,
  })
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}
