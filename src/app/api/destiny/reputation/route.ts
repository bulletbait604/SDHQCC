import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verifyAuth'
import { destinyAuthHandler } from '@/lib/destiny/apiHandler'
import { saveReputationReview, getReputationReviewsForUser } from '@/lib/destiny/store'
import type { ReputationReview } from '@/lib/destiny/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const userId = authUser.username.toLowerCase()
    const { searchParams } = new URL(req.url)
    const target = (searchParams.get('user') ?? userId).toLowerCase()
    const reviews = await getReputationReviewsForUser(target)
    return NextResponse.json({ reviews, userId: target })
  })
}

export async function POST(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const reviewerId = authUser.username.toLowerCase()
    const body = (await req.json().catch(() => ({}))) as Partial<ReputationReview>

    const reviewedUserId = body.reviewedUserId?.toLowerCase()
    if (!reviewedUserId) {
      return NextResponse.json({ error: 'reviewedUserId required' }, { status: 400 })
    }
    if (reviewedUserId === reviewerId) {
      return NextResponse.json({ error: 'Cannot review yourself' }, { status: 400 })
    }

    const review: ReputationReview = {
      id: body.id ?? `rep-${reviewerId}-${reviewedUserId}-${Date.now()}`,
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
