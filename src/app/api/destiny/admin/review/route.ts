import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verifyAuth'
import { destinyStaffHandler } from '@/lib/destiny/apiHandler'
import { getAdminReviewQueue, resolveAdminReview } from '@/lib/destiny/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    const queue = await getAdminReviewQueue()
    return NextResponse.json({ queue })
  })
}

export async function POST(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const body = await req.json().catch(() => ({}))
    const { reviewId, decision, notes } = body as {
      reviewId?: string
      decision?: string
      notes?: string
    }
    if (!reviewId || !decision) {
      return NextResponse.json({ error: 'reviewId and decision required' }, { status: 400 })
    }

    const ok = await resolveAdminReview(
      reviewId,
      decision,
      authUser.username.toLowerCase(),
      notes
    )

    if (!ok) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      reviewId,
      decision,
      notes,
      message: 'Review decision saved.',
    })
  })
}
