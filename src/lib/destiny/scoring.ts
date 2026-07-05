import { SCORING } from '@/lib/destiny/env'
import type { ActivityType } from '@/lib/destiny/types'

export interface ScoringInput {
  activityType: ActivityType
  clanMemberCount: number
  randoCount: number
  isFullClanTeam: boolean
  completed: boolean
  checkpointLikely: boolean
  verificationStatus: 'verified' | 'pending' | 'flagged' | 'rejected'
  suspiciousScore: number
}

export interface ScoringResult {
  points: number
  eligible: boolean
  reasons: string[]
}

/** Calculate points for a run per DestinyTopNest rules. */
export function calculateRunPoints(input: ScoringInput): ScoringResult {
  const reasons: string[] = []

  if (!input.completed) {
    return { points: 0, eligible: false, reasons: ['Run not completed'] }
  }
  if (input.checkpointLikely) {
    return { points: 0, eligible: false, reasons: ['Checkpoint run — requires manual approval for scoring'] }
  }
  if (input.verificationStatus !== 'verified') {
    return { points: 0, eligible: false, reasons: [`Verification status: ${input.verificationStatus}`] }
  }
  if (input.suspiciousScore >= 70) {
    return { points: 0, eligible: false, reasons: ['Suspicious score 70+ — blocked until admin approval'] }
  }

  const maxRandos =
    input.activityType === 'raid' ? SCORING.maxRandosRaid : SCORING.maxRandosDungeon
  if (input.randoCount > maxRandos) {
    reasons.push(`Rando count ${input.randoCount} exceeds max ${maxRandos} for ${input.activityType}`)
  }

  const clanPts = input.clanMemberCount * SCORING.pointsPerClanMember
  const randoPts = Math.min(input.randoCount, maxRandos) * SCORING.pointsPerRando
  const points = clanPts + randoPts

  if (input.isFullClanTeam) {
    reasons.push('Eligible for Full Clan Team leaderboard category')
  }

  return { points, eligible: true, reasons }
}
