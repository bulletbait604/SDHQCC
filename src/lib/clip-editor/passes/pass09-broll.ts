import { brollPlanSchema } from '@/lib/clip-editor/schemas'
import type { BrollPlan, RetentionAnalysis, TranscriptAnalysis } from '@/lib/clip-editor/types'

export function runBrollPass(
  transcript: TranscriptAnalysis,
  retention: RetentionAnalysis
): BrollPlan {
  const severeDrops = retention.dropMoments.filter((d) => d.severity >= 0.65)
  const avgRetention =
    retention.retentionCurve.length > 0
      ? retention.retentionCurve.reduce((s, p) => s + p.retention, 0) / retention.retentionCurve.length
      : 0.7

  const topicHints = ['money', 'cars', 'explosion', 'space', 'reaction']
  const text = transcript.fullTranscript.toLowerCase()
  const matched = topicHints.filter((t) => text.includes(t.slice(0, 4)))

  const confidence =
    severeDrops.length >= 2 && avgRetention < 0.62 && matched.length > 0 ? 0.82 : 0.45

  if (confidence < 0.8) {
    return brollPlanSchema.parse({
      enabled: false,
      placements: [],
      maxRuntimePercent: 20,
    })
  }

  const placements = severeDrops.slice(0, 2).map((d) => ({
    start: d.start,
    end: Math.min(d.end, d.start + Math.min(3, transcript.durationSeconds * 0.08)),
    prompt: `B-roll: ${matched[0] || 'reaction'} visual, high energy, vertical 9:16`,
    confidence,
    provider: 'none' as const,
  }))

  return brollPlanSchema.parse({
    enabled: placements.length > 0,
    placements,
    maxRuntimePercent: 20,
  })
}
