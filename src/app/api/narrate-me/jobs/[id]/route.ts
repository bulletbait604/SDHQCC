import { NextRequest, NextResponse } from 'next/server'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { narrateMeErrorResponse } from '@/lib/narrateMe/http'
import { getNarrateMeJobForUser, retryJob } from '@/lib/narrateMe/pipeline'
import { elapsedSeconds, estimateRemainingSeconds } from '@/lib/narrateMe/progress'
import { kickNarrateMeTick } from '@/lib/narrateMe/kickoff'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyOwnerUser(req)
    const job = await getNarrateMeJobForUser(params.id, user.username)
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    if (
      job.status === 'analyzing' ||
      job.status === 'generating_voice' ||
      job.status === 'processing_audio' ||
      (job.status === 'awaiting_script_approval' && job.script.status === 'running')
    ) {
      kickNarrateMeTick(job.jobId)
    }
    return NextResponse.json({
      job,
      elapsedSeconds: elapsedSeconds(job),
      estimateRemainingSeconds: estimateRemainingSeconds(job),
    })
  } catch (err) {
    return narrateMeErrorResponse(err)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyOwnerUser(req)
    const job = await getNarrateMeJobForUser(params.id, user.username)
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    const saved = await retryJob(job)
    return NextResponse.json({ job: saved })
  } catch (err) {
    return narrateMeErrorResponse(err)
  }
}
