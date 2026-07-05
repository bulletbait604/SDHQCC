import type { LeaderboardEntry, ReputationReview, RunRecord } from '@/lib/destiny/types'
import type { StoredDestinyUser } from '@/lib/destiny/destinyUserStore'

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
    if (run.verificationStatus !== 'verified' || !run.ownerUserId) continue

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
