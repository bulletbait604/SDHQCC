import { NextRequest, NextResponse } from 'next/server'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { narrateMeErrorResponse } from '@/lib/narrateMe/http'
import { getNarrateMeJobForUser, startAudioAssembly } from '@/lib/narrateMe/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyOwnerUser(req)
    const job = await getNarrateMeJobForUser(params.id, user.username)
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    if (job.voice.status !== 'complete') {
      return NextResponse.json({ error: 'Generate voice before assembling audio.' }, { status: 409 })
    }
    const saved = await startAudioAssembly(job)
    return NextResponse.json({ job: saved })
  } catch (err) {
    return narrateMeErrorResponse(err)
  }
}
