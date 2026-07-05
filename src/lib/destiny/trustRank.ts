import type { TrustRankSummary, TrustReview } from '@/lib/destiny/types'

export type KnowledgeScore = 1 | 2 | 3
export type VibesScore = 1 | 2 | 3

export type KnowledgeTier = 'New Light' | 'Guardian' | 'Top Nest'
export type VibesTier = 'Chill' | 'Excited' | 'Composed'

export const KNOWLEDGE_VOTE_LABELS: Record<KnowledgeScore, string> = {
  1: 'Knows almost 0 about mechanics',
  2: 'Can manage the basics',
  3: 'Activity professional',
}

export const VIBES_VOTE_LABELS: Record<VibesScore, string> = {
  1: 'Quiet',
  2: 'Annoying',
  3: 'Leader',
}

export function knowledgeTierFromAvg(avg: number): KnowledgeTier {
  if (avg < 1.67) return 'New Light'
  if (avg < 2.34) return 'Guardian'
  return 'Top Nest'
}

export function vibesTierFromAvg(avg: number): VibesTier {
  if (avg < 1.67) return 'Chill'
  if (avg < 2.34) return 'Excited'
  return 'Composed'
}

/** Combine Knowledge + Vibes tiers into a Top Nest title. */
export function computeTopNestTitle(knowledgeTier: KnowledgeTier, vibesTier: VibesTier): string {
  if (knowledgeTier === 'Top Nest' && vibesTier === 'Composed') return 'Top Nest Pro'
  if (knowledgeTier === 'Top Nest' && vibesTier === 'Excited') return 'Top Nest Ace'
  return `${vibesTier} ${knowledgeTier}`
}

export function computeTrustRank(reviews: TrustReview[]): TrustRankSummary {
  if (!reviews.length) {
    return {
      knowledgeAvg: 0,
      vibesAvg: 0,
      knowledgeTier: 'New Light',
      vibesTier: 'Chill',
      topNestTitle: 'Unrated Guardian',
      reviewCount: 0,
    }
  }

  const knowledgeAvg =
    Math.round((reviews.reduce((s, r) => s + r.knowledge, 0) / reviews.length) * 10) / 10
  const vibesAvg =
    Math.round((reviews.reduce((s, r) => s + r.vibes, 0) / reviews.length) * 10) / 10

  const knowledgeTier = knowledgeTierFromAvg(knowledgeAvg)
  const vibesTier = vibesTierFromAvg(vibesAvg)

  return {
    knowledgeAvg,
    vibesAvg,
    knowledgeTier,
    vibesTier,
    topNestTitle: computeTopNestTitle(knowledgeTier, vibesTier),
    reviewCount: reviews.length,
  }
}

export function clampTrustScore(value: unknown, min: 1, max: 3): KnowledgeScore | VibesScore {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 2
  return Math.max(min, Math.min(max, Math.round(n))) as KnowledgeScore
}
