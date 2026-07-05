import { LEGITIMACY_THRESHOLDS } from '@/lib/destiny/env'
import type { ActivityType, AiReview, LegitimacyStatus, RunRecord } from '@/lib/destiny/types'

export interface LegitimacyInput {
  activityType: ActivityType
  durationSeconds: number
  completed: boolean
  checkpointLikely: boolean
  playerCount: number
  teamAvgDeaths: number
  teamAvgKills: number
}

/** Heuristic legitimacy review — Phase 3 rules engine (no external LLM yet). */
export function evaluateRunLegitimacy(input: LegitimacyInput): AiReview {
  const reasons: string[] = []
  let score = 0

  if (!input.completed) {
    return {
      legitimacyStatus: 'highly_suspicious',
      suspiciousScore: 95,
      reasons: ['Activity not marked completed'],
      recommendation: 'reject',
      summary: 'Incomplete activity — not eligible for scoring.',
    }
  }

  if (input.checkpointLikely) {
    score += 35
    reasons.push('Likely checkpoint start (not from beginning)')
  }

  const minDuration = input.activityType === 'raid' ? 900 : 480
  const maxDuration = input.activityType === 'raid' ? 7200 : 3600

  if (input.durationSeconds < minDuration) {
    score += 40
    reasons.push(`Duration ${input.durationSeconds}s unusually short for ${input.activityType}`)
  } else if (input.durationSeconds > maxDuration) {
    score += 15
    reasons.push(`Duration ${input.durationSeconds}s unusually long`)
  } else {
    reasons.push('Duration within expected range')
  }

  if (input.playerCount < (input.activityType === 'raid' ? 6 : 3)) {
    score += 25
    reasons.push(`Only ${input.playerCount} players in fireteam`)
  }

  if (input.teamAvgDeaths === 0 && input.durationSeconds < minDuration * 1.2) {
    score += 20
    reasons.push('Zero deaths with very fast clear')
  }

  if (input.teamAvgKills > 0 && input.teamAvgDeaths / input.teamAvgKills > 0.5) {
    score += 10
    reasons.push('High death-to-kill ratio')
  }

  score = Math.min(100, Math.max(0, score))

  let legitimacyStatus: LegitimacyStatus = 'clean'
  if (score > LEGITIMACY_THRESHOLDS.manualReviewMax) legitimacyStatus = 'highly_suspicious'
  else if (score > LEGITIMACY_THRESHOLDS.warningMax) legitimacyStatus = 'suspicious'
  else if (score > LEGITIMACY_THRESHOLDS.autoVerifyMax) legitimacyStatus = 'warning'

  let recommendation: AiReview['recommendation'] = 'approve'
  if (score > LEGITIMACY_THRESHOLDS.manualReviewMax) recommendation = 'reject'
  else if (score > LEGITIMACY_THRESHOLDS.autoVerifyMax) recommendation = 'manual_review'

  const summary =
    recommendation === 'approve'
      ? 'Run passes automated legitimacy checks.'
      : recommendation === 'manual_review'
        ? 'Run flagged for admin review before scoring.'
        : 'Run failed automated legitimacy checks.'

  return { legitimacyStatus, suspiciousScore: score, reasons, recommendation, summary }
}

export function verificationStatusFromReview(review: AiReview): RunRecord['verificationStatus'] {
  if (review.recommendation === 'approve') return 'verified'
  if (review.recommendation === 'reject') return 'rejected'
  return 'flagged'
}
