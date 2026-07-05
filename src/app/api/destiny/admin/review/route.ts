import { NextRequest, NextResponse } from 'next/server'
import { destinyStaffHandler } from '@/lib/destiny/apiHandler'
import { getAdminReviewQueue } from '@/lib/destiny/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    const queue = await getAdminReviewQueue()
    return NextResponse.json({ queue })
  })
}

export async function POST(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    const body = await req.json().catch(() => ({}))
    const { reviewId, decision, notes } = body as {
      reviewId?: string
      decision?: string
      notes?: string
    }
    if (!reviewId || !decision) {
      return NextResponse.json({ error: 'reviewId and decision required' }, { status: 400 })
    }
    return NextResponse.json({
      ok: true,
      reviewId,
      decision,
      notes,
      message: 'Review action recorded (mock — Phase 3 will persist to Mongo).',
    })
  })
}
