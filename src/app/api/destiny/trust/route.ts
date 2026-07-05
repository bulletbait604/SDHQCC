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
  findTrustReview,
  getRunsForParticipant,
  getTrustReviewsByReviewer,
  getTrustReviewsForUser,
  loadUsersMap,
  saveTrustReview,
} from '@/lib/destiny/store'
import { clampTrustScore, computeTrustRank } from '@/lib/destiny/trustRank'
import type { TrustReview } from '@/lib/destiny/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const userId = authUser.username.toLowerCase()
    const { searchParams } = new URL(req.url)
    const scope = searchParams.get('scope')
    const target = (searchParams.get('user') ?? userId).toLowerCase()

    if (scope === 'reviewable') {
      const stored = await getDestinyUserBySiteUserId(userId)
      const [runs, usersById, trustByReviewer] = await Promise.all([
        getRunsForParticipant(userId, stored?.bungieMembershipId, 30),
        loadUsersMap(),
        getTrustReviewsByReviewer(userId),
      ])
      const reviewableRuns = buildReviewableRuns(
        userId,
        stored?.bungieMembershipId,
        runs,
        usersByMembershipMap(Array.from(usersById.values())),
        trustByReviewer.map((t) => ({
          id: t.id,
          reviewerId: t.reviewerId,
          reviewedUserId: t.reviewedUserId,
          runId: t.runId,
          communication: 0,
          reliability: 0,
          mechanics: 0,
          friendly: 0,
          teaching: 0,
          punctual: 0,
          wouldPlayAgain: true,
          createdAt: t.createdAt,
        }))
      )
      return NextResponse.json({ reviewableRuns })
    }

    const reviews = await getTrustReviewsForUser(target)
    return NextResponse.json({
      reviews,
      trustRank: computeTrustRank(reviews),
      userId: target,
    })
  })
}

export async function POST(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const reviewerId = authUser.username.toLowerCase()
    const stored = await getDestinyUserBySiteUserId(reviewerId)
    const body = (await req.json().catch(() => ({}))) as Partial<TrustReview> & {
      reviewedBungieMembershipId?: string
    }

    let reviewedUserId = body.reviewedUserId?.toLowerCase()
    if (!reviewedUserId && body.reviewedBungieMembershipId) {
      const linked = await getDestinyUserByBungieMembershipId(body.reviewedBungieMembershipId)
      reviewedUserId = linked?.userId
    }

    if (!reviewedUserId) {
      return NextResponse.json(
        { error: 'reviewedUserId required — rando must be linked on Top Nest' },
        { status: 400 }
      )
    }
    if (reviewedUserId === reviewerId) {
      return NextResponse.json({ error: 'Cannot commend yourself' }, { status: 400 })
    }
    if (!body.runId) {
      return NextResponse.json({ error: 'runId required' }, { status: 400 })
    }

    const [runs, usersById] = await Promise.all([
      getRunsForParticipant(reviewerId, stored?.bungieMembershipId, 50),
      loadUsersMap(),
    ])
    const validation = validateReviewSubmission(
      reviewerId,
      stored?.bungieMembershipId,
      reviewedUserId,
      body.runId,
      runs,
      usersByMembershipMap(Array.from(usersById.values()))
    )
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const existing = await findTrustReview(reviewerId, reviewedUserId, body.runId)
    if (existing) {
      return NextResponse.json({ error: 'You already commended this rando for this run' }, { status: 409 })
    }

    const review: TrustReview = {
      id: `trust-${reviewerId}-${reviewedUserId}-${body.runId}`,
      reviewerId,
      reviewedUserId,
      runId: body.runId,
      knowledge: clampTrustScore(body.knowledge, 1, 3) as 1 | 2 | 3,
      vibes: clampTrustScore(body.vibes, 1, 3) as 1 | 2 | 3,
      createdAt: new Date().toISOString(),
    }

    await saveTrustReview(review)
    return NextResponse.json({ ok: true, review, trustRank: computeTrustRank(await getTrustReviewsForUser(reviewedUserId)) })
  })
}
