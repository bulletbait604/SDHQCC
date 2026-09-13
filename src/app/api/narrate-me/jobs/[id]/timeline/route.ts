import { NextRequest, NextResponse } from 'next/server'
import { verifyRndToolUser } from '@/lib/auth/staffAccess'
import { narrateMeErrorResponse } from '@/lib/narrateMe/http'
import { getNarrateMeJobForUser } from '@/lib/narrateMe/pipeline'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyRndToolUser(req, 'narrate-me')
    const job = await getNarrateMeJobForUser(params.id, user.username)
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    return NextResponse.json({
      timeline: job.timeline,
      analysis: job.analysis,
    })
  } catch (err) {
    return narrateMeErrorResponse(err)
  }
}
