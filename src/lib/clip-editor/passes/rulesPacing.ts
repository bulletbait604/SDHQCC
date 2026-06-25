import { pacingPlanSchema } from '@/lib/clip-editor/schemas'
import type { ClipEditorPlatform, CutRanking, PacingPlan, TranscriptAnalysis } from '@/lib/clip-editor/types'

function targetVisualChangeSeconds(platform: ClipEditorPlatform): number {
  switch (platform) {
    case 'tiktok':
      return 1.5
    case 'youtube':
      return 3
    case 'reels':
      return 2.5
    default:
      return 2
  }
}

/** Deterministic pacing for fast tier — no Gemini call. */
export function runRulesPacingPass(
  transcript: TranscriptAnalysis,
  ranking: CutRanking,
  platform: ClipEditorPlatform
): PacingPlan {
  const top = ranking.segments[0]
  const target = targetVisualChangeSeconds(platform)
  const zooms: PacingPlan['zooms'] = []

  if (top) {
    for (let t = top.start + target; t < top.end - 0.4; t += target) {
      zooms.push({
        atSeconds: Number(t.toFixed(2)),
        style: platform === 'tiktok' ? 'zoomIn' : 'zoomInSlow',
        durationSeconds: platform === 'youtube' ? 0.9 : 0.55,
      })
      if (zooms.length >= 10) break
    }
  }

  const emphasisWords = transcript.words.filter((w) => /[!?]$/.test(w.word)).slice(0, 4)
  for (const w of emphasisWords) {
    if (zooms.some((z) => Math.abs(z.atSeconds - w.start) < 0.35)) continue
    zooms.push({
      atSeconds: w.start,
      style: 'zoomIn',
      durationSeconds: 0.45,
    })
  }

  return pacingPlanSchema.parse({
    cuts: [],
    zooms: zooms.slice(0, 12),
    effectTiming: [],
    targetVisualChangeSeconds: target,
  })
}
