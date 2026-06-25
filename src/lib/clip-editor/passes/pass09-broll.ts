import { brollPlanSchema } from '@/lib/clip-editor/schemas'
import type { BrollPlan, GeminiVideoPlan, RetentionAnalysis, TranscriptAnalysis, ViralityReview } from '@/lib/clip-editor/types'
import type { ClipEditorTierConfig } from '@/lib/clip-editor/tier'
import { clipEditorTierConfig } from '@/lib/clip-editor/tier'
import {
  generateRunwayBrollAsset,
  shouldEnrichWithRunway,
} from '@/lib/clip-editor/services/runwayBroll'
import { resolveRunwayApiSecret } from '@/lib/clipEditorServerKeys'

export async function runBrollPass(params: {
  transcript: TranscriptAnalysis
  retention: RetentionAnalysis
  tier?: ClipEditorTierConfig
  geminiVideo?: GeminiVideoPlan
  viralityEffects?: ViralityReview
  username: string
}): Promise<BrollPlan> {
  const tier = params.tier ?? clipEditorTierConfig()
  const disabled = brollPlanSchema.parse({
    enabled: false,
    placements: [],
    maxRuntimePercent: 20,
  })

  if (!tier.broll.enabled || tier.broll.maxPlacements <= 0) {
    return disabled
  }

  const topVirality =
    params.viralityEffects?.viralityScore ??
    params.geminiVideo?.viralSegments?.[0]?.viralityScore ??
    0

  const severeDrops = params.retention.dropMoments.filter(
    (d) => d.severity >= tier.broll.confidenceThreshold
  )
  const avgRetention =
    params.retention.retentionCurve.length > 0
      ? params.retention.retentionCurve.reduce((s, p) => s + p.retention, 0) /
        params.retention.retentionCurve.length
      : 0.7

  const topicHints = ['money', 'cars', 'explosion', 'space', 'reaction', 'win', 'fail']
  const text = params.transcript.fullTranscript.toLowerCase()
  const matched = topicHints.filter((t) => text.includes(t))

  const highViralityBoost = shouldEnrichWithRunway(topVirality) ? 0.25 : 0
  const confidence =
    severeDrops.length >= 1 && (avgRetention < 0.68 || highViralityBoost > 0) && matched.length > 0
      ? Math.min(0.95, 0.72 + highViralityBoost)
      : highViralityBoost > 0
        ? 0.78
        : 0.45

  if (confidence < tier.broll.confidenceThreshold && !shouldEnrichWithRunway(topVirality)) {
    return disabled
  }

  const dropSources =
    severeDrops.length > 0
      ? severeDrops
      : params.geminiVideo?.viralSegments?.slice(0, 2).map((s) => ({
          start: s.start,
          end: s.end,
          severity: s.viralityScore / 100,
          reason: s.explanation,
        })) ?? []

  const placements: BrollPlan['placements'] = []

  for (const d of dropSources.slice(0, tier.broll.maxPlacements)) {
    const segTitle =
      params.geminiVideo?.viralSegments?.find(
        (s) => s.start <= d.start + 0.5 && s.end >= d.start
      )?.title ?? 'Highlight moment'

    const prompt = `Cinematic vertical B-roll for "${segTitle}": ${matched[0] || 'high energy reaction'}, 9:16, scroll-stopping, no text`
    const useRunway =
      shouldEnrichWithRunway(topVirality) && Boolean(resolveRunwayApiSecret())

    let assetUrl: string | undefined
    let assetR2Key: string | undefined

    if (useRunway) {
      const generated = await generateRunwayBrollAsset({
        prompt,
        username: params.username,
        durationSeconds: 3,
      })
      if (generated) {
        assetUrl = generated.assetUrl
        assetR2Key = generated.assetR2Key
      }
    }

    placements.push({
      start: d.start,
      end: Math.min(
        d.end,
        d.start + Math.min(3, params.transcript.durationSeconds * 0.08)
      ),
      prompt,
      confidence,
      provider: useRunway && assetUrl ? 'runway' : tier.broll.provider,
      ...(assetUrl ? { assetUrl } : {}),
      ...(assetR2Key ? { assetR2Key } : {}),
    })
  }

  return brollPlanSchema.parse({
    enabled: placements.length > 0,
    placements,
    maxRuntimePercent: 20,
  })
}
