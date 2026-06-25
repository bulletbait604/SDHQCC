import { brollPlanSchema } from '@/lib/clip-editor/schemas'
import type { BrollPlan, RetentionAnalysis, TranscriptAnalysis } from '@/lib/clip-editor/types'
import type { ClipEditorTierConfig } from '@/lib/clip-editor/tier'
import { clipEditorTierConfig } from '@/lib/clip-editor/tier'

export function runBrollPass(
  transcript: TranscriptAnalysis,
  retention: RetentionAnalysis,
  tier: ClipEditorTierConfig = clipEditorTierConfig()
): BrollPlan {
  const disabled = brollPlanSchema.parse({
    enabled: false,
    placements: [],
    maxRuntimePercent: 20,
  })

  if (!tier.broll.enabled || tier.broll.maxPlacements <= 0) {
    return disabled
  }

  const severeDrops = retention.dropMoments.filter(
    (d) => d.severity >= tier.broll.confidenceThreshold
  )
  const avgRetention =
    retention.retentionCurve.length > 0
      ? retention.retentionCurve.reduce((s, p) => s + p.retention, 0) / retention.retentionCurve.length
      : 0.7

  const topicHints = ['money', 'cars', 'explosion', 'space', 'reaction']
  const text = transcript.fullTranscript.toLowerCase()
  const matched = topicHints.filter((t) => text.includes(t.slice(0, 4)))

  const confidence =
    severeDrops.length >= 1 && avgRetention < 0.68 && matched.length > 0 ? 0.82 : 0.45

  if (confidence < tier.broll.confidenceThreshold) {
    return disabled
  }

  const placements = severeDrops.slice(0, tier.broll.maxPlacements).map((d) => ({
    start: d.start,
    end: Math.min(d.end, d.start + Math.min(3, transcript.durationSeconds * 0.08)),
    prompt: `B-roll: ${matched[0] || 'reaction'} visual, high energy, vertical 9:16`,
    confidence,
    provider: tier.broll.provider,
  }))

  return brollPlanSchema.parse({
    enabled: placements.length > 0,
    placements,
    maxRuntimePercent: 20,
  })
}
