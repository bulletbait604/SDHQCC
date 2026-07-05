import type { ReputationReview } from '@/lib/destiny/types'

const REVIEW_FIELDS = [
  'communication',
  'reliability',
  'mechanics',
  'friendly',
  'teaching',
  'punctual',
] as const

/** Average 1–5 reputation from fireteam reviews (Phase 5). */
export function computeReputationScore(reviews: ReputationReview[]): number {
  if (!reviews.length) return 0

  let total = 0
  let count = 0
  for (const review of reviews) {
    for (const field of REVIEW_FIELDS) {
      const value = review[field]
      if (typeof value === 'number' && value > 0) {
        total += value
        count++
      }
    }
  }

  if (!count) return 0
  return Math.round((total / count) * 10) / 10
}

export function reputationBadges(reviews: ReputationReview[], verifiedClears: number): string[] {
  const badges: string[] = []
  const score = computeReputationScore(reviews)
  if (verifiedClears >= 1) badges.push('Verified raider')
  if (verifiedClears >= 10) badges.push('10+ verified clears')
  if (score >= 4.5 && reviews.length >= 3) badges.push('Trusted fireteam')
  if (reviews.length >= 5) badges.push(`${reviews.length} fireteam reviews`)
  return badges
}
