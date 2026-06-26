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
    const excerptLen = top.end - top.start
    // Gentle open zoom only — avoid rapid-fire zoom cuts on a continuous excerpt.
    zooms.push({
      atSeconds: Number(top.start.toFixed(2)),
      style: platform === 'tiktok' ? 'zoomInSlow' : 'zoomInSlow',
      durationSeconds: Math.min(1.2, excerptLen * 0.08),
    })
    if (excerptLen > 18 && platform !== 'tiktok') {
      zooms.push({
        atSeconds: Number((top.start + excerptLen * 0.55).toFixed(2)),
        style: 'zoomInSlow',
        durationSeconds: 0.75,
      })
    }
  }

  return pacingPlanSchema.parse({
    cuts: [],
    zooms: zooms.slice(0, 4),
    effectTiming: [],
    targetVisualChangeSeconds: target,
  })
}
