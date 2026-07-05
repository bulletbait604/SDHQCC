import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verifyAuth'
import { destinyAuthHandler } from '@/lib/destiny/apiHandler'
import { getDestinyUserBySiteUserId, getDestinyUserByBungieMembershipId } from '@/lib/destiny/destinyUserStore'
import {
  buildReviewableRuns,
  usersByMembershipMap,
  validateReviewSubmission,
} from '@/lib/destiny/fireteamReputation'
import {
  findReputationReview,
  getReputationReviewsByReviewer,
  getReputationReviewsForUser,
  getRunsForParticipant,
  loadUsersMap,
  saveReputationReview,
} from '@/lib/destiny/store'
import type { ReputationReview } from '@/lib/destiny/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const userId = authUser.username.toLowerCase()
    const { searchParams } = new URL(req.url)
    const scope = searchParams.get('scope')
    const target = (searchParams.get('user') ?? userId).toLowerCase()

    if (scope === 'written') {
      const reviews = await getReputationReviewsByReviewer(userId)
      return NextResponse.json({ reviews, userId })
    }

    if (scope === 'reviewable') {
      const stored = await getDestinyUserBySiteUserId(userId)
      const [runs, usersById, reviewsByReviewer] = await Promise.all([
        getRunsForParticipant(userId, stored?.bungieMembershipId, 30),
        loadUsersMap(),
        getReputationReviewsByReviewer(userId),
      ])
      const reviewableRuns = buildReviewableRuns(
        userId,
        stored?.bungieMembershipId,
        runs,
        usersByMembershipMap(Array.from(usersById.values())),
        reviewsByReviewer
      )
      return NextResponse.json({ reviewableRuns })
    }

    const reviews = await getReputationReviewsForUser(target)
    return NextResponse.json({ reviews, userId: target })
  })
}

export async function POST(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const reviewerId = authUser.username.toLowerCase()
    const stored = await getDestinyUserBySiteUserId(reviewerId)
    const body = (await req.json().catch(() => ({}))) as Partial<ReputationReview> & {
      reviewedBungieMembershipId?: string
    }

    let reviewedUserId = body.reviewedUserId?.toLowerCase()

    if (!reviewedUserId && body.reviewedBungieMembershipId) {
      const linked = await getDestinyUserByBungieMembershipId(body.reviewedBungieMembershipId)
      reviewedUserId = linked?.userId
    }

    if (!reviewedUserId) {
      return NextResponse.json(
        { error: 'reviewedUserId or reviewedBungieMembershipId required (teammate must be linked on Top Nest)' },
        { status: 400 }
      )
    }
    if (reviewedUserId === reviewerId) {
      return NextResponse.json({ error: 'Cannot review yourself' }, { status: 400 })
    }

    const [runs, usersById] = await Promise.all([
      getRunsForParticipant(reviewerId, stored?.bungieMembershipId, 50),
      loadUsersMap(),
    ])
    const membershipMap = usersByMembershipMap(Array.from(usersById.values()))

    const validation = validateReviewSubmission(
      reviewerId,
      stored?.bungieMembershipId,
      reviewedUserId,
      body.runId,
      runs,
      membershipMap
    )
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    if (body.runId) {
      const existing = await findReputationReview(reviewerId, reviewedUserId, body.runId)
      if (existing) {
        return NextResponse.json({ error: 'You already reviewed this teammate for this run' }, { status: 409 })
      }
    }

    const review: ReputationReview = {
      id: body.id ?? `rep-${reviewerId}-${reviewedUserId}-${body.runId ?? Date.now()}`,
      reviewerId,
      reviewedUserId,
      runId: body.runId,
      communication: clampScore(body.communication),
      reliability: clampScore(body.reliability),
      mechanics: clampScore(body.mechanics),
      friendly: clampScore(body.friendly),
      teaching: clampScore(body.teaching),
      punctual: clampScore(body.punctual),
      wouldPlayAgain: Boolean(body.wouldPlayAgain),
      notes: body.notes?.slice(0, 500),
      createdAt: new Date().toISOString(),
    }

    await saveReputationReview(review)
    return NextResponse.json({ ok: true, review })
  })
}

function clampScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 3
  return Math.max(1, Math.min(5, Math.round(n)))
}
