import type { LeaderboardCategory, LeaderboardEntry, PrizeClaim, ReputationReview, RunRecord, Season } from '@/lib/destiny/types'
import type { StoredDestinyUser } from '@/lib/destiny/destinyUserStore'
import type { UserPrizeTrackEntry } from '@/lib/destiny/seasonPrizes'

export interface ReviewableTeammate {
  siteUserId: string
  displayName: string
  membershipId: string
  alreadyReviewed: boolean
}

export interface ReviewableRun {
  runId: string
  activityName: string
  completedAt: string
  teammates: ReviewableTeammate[]
}

export function userParticipatedInRun(
  reviewerId: string,
  reviewerMembershipId: string | undefined,
  run: RunRecord
): boolean {
  if (run.ownerUserId === reviewerId) return true
  if (!reviewerMembershipId) return false
  return run.teamMembers.some((m) => m.membershipId === reviewerMembershipId)
}

/** Verified runs where the reviewer can rate linked Top Nest teammates (Phase 5). */
export function buildReviewableRuns(
  reviewerId: string,
  reviewerMembershipId: string | undefined,
  runs: RunRecord[],
  usersByMembershipId: Map<string, StoredDestinyUser>,
  reviewsByReviewer: ReputationReview[]
): ReviewableRun[] {
  const reviewedKeys = new Set(
    reviewsByReviewer.map((r) => `${r.runId ?? ''}:${r.reviewedUserId}`)
  )

  const results: ReviewableRun[] = []

  for (const run of runs) {
    if (run.verificationStatus !== 'verified') continue
    if (!userParticipatedInRun(reviewerId, reviewerMembershipId, run)) continue

    const teammates: ReviewableTeammate[] = []

    for (const member of run.teamMembers) {
      if (member.membershipId === reviewerMembershipId) continue

      const linked = usersByMembershipId.get(member.membershipId)
      if (!linked?.userId || linked.userId === reviewerId) continue

      const key = `${run.id}:${linked.userId}`
      teammates.push({
        siteUserId: linked.userId,
        displayName: linked.bungieDisplayName || member.displayName,
        membershipId: member.membershipId,
        alreadyReviewed: reviewedKeys.has(key),
      })
    }

    if (teammates.some((t) => !t.alreadyReviewed)) {
      results.push({
        runId: run.id,
        activityName: run.activityName,
        completedAt: run.completedAt,
        teammates,
      })
    }
  }

  return results.slice(0, 10)
}

export function validateReviewSubmission(
  reviewerId: string,
  reviewerMembershipId: string | undefined,
  reviewedUserId: string,
  runId: string | undefined,
  runs: RunRecord[],
  usersByMembershipId: Map<string, StoredDestinyUser>
): { ok: true } | { ok: false; error: string } {
  if (!runId) {
    return { ok: false, error: 'runId required for fireteam reviews' }
  }

  const run = runs.find((r) => r.id === runId)
  if (!run) {
    return { ok: false, error: 'Run not found' }
  }
  if (run.verificationStatus !== 'verified') {
    return { ok: false, error: 'Only verified runs can be reviewed' }
  }
  if (!userParticipatedInRun(reviewerId, reviewerMembershipId, run)) {
    return { ok: false, error: 'You must have been on this fireteam to submit a review' }
  }

  const onFireteam = run.teamMembers.some((m) => {
    const linked = usersByMembershipId.get(m.membershipId)
    return linked?.userId === reviewedUserId
  })
  if (!onFireteam) {
    return { ok: false, error: 'Reviewed player was not on this fireteam' }
  }

  return { ok: true }
}

export function usersByMembershipMap(users: StoredDestinyUser[]): Map<string, StoredDestinyUser> {
  const map = new Map<string, StoredDestinyUser>()
  for (const user of users) {
    if (user.bungieMembershipId) {
      map.set(user.bungieMembershipId, user)
    }
  }
  return map
}

export function summarizeSeasonStandings(entries: LeaderboardEntry[]) {
  return entries
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => ({
      category: entry.category,
      rank: entry.rank,
      points: entry.points,
      verifiedClears: entry.verifiedClears,
    }))
}

const PRIZE_RANK_LIMIT: Record<LeaderboardCategory, number> = {
  raid: 5,
  dungeon: 5,
  full_clan_team: 3,
}

export function prizeEligibleTracks(
  prizeTrack: UserPrizeTrackEntry[],
  season: Season,
  hallOfFame: { category: LeaderboardCategory; rank: number; userId?: string; prize: string }[],
  userId: string
): UserPrizeTrackEntry[] {
  if (season.status === 'archived' && season.winners?.length) {
    return season.winners
      .filter((w) => w.userId === userId)
      .map((w) => ({
        category: w.category,
        rank: w.rank,
        points: 0,
        verifiedClears: 0,
        prizeIfHeld: w.prize,
      }))
  }

  return prizeTrack.filter((t) => t.rank <= PRIZE_RANK_LIMIT[t.category])
}

export function canSubmitPrizeClaim(
  _userId: string,
  season: Season,
  eligibleTracks: UserPrizeTrackEntry[],
  existingClaims: PrizeClaim[],
  category: LeaderboardCategory
): { ok: true; prize: string; rank: number } | { ok: false; error: string } {
  const track = eligibleTracks.find((t) => t.category === category)
  if (!track) {
    return { ok: false, error: 'You are not in a prize-winning rank for this category' }
  }

  if (existingClaims.some((c) => c.category === category && c.status !== 'rejected')) {
    return { ok: false, error: 'You already submitted a claim for this category' }
  }

  const seasonEnded = season.status === 'archived' || Date.now() >= new Date(season.endDate).getTime()
  if (!seasonEnded && season.status === 'active') {
    // Allow pre-registration when holding a prize rank during active season
    const inLiveLeaders = track.rank <= PRIZE_RANK_LIMIT[category]
    if (!inLiveLeaders) {
      return { ok: false, error: 'Hold a prize rank to submit a claim' }
    }
  }

  return { ok: true, prize: track.prizeIfHeld, rank: track.rank }
}
