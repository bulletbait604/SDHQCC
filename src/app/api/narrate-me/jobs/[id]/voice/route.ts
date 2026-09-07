import { NextRequest, NextResponse } from 'next/server'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { narrateMeErrorResponse } from '@/lib/narrateMe/http'
import { getNarrateMeJobForUser, startVoice } from '@/lib/narrateMe/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyOwnerUser(req)
    const job = await getNarrateMeJobForUser(params.id, user.username)
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    const saved = await startVoice(job)
    return NextResponse.json({ job: saved })
  } catch (err) {
    return narrateMeErrorResponse(err)
  }
}
