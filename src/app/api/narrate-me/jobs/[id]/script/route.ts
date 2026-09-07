import { NextRequest, NextResponse } from 'next/server'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { narrateMeErrorResponse } from '@/lib/narrateMe/http'
import {
  getNarrateMeJobForUser,
  patchScript,
  regenerateJobScript,
  regenerateOneSegment,
} from '@/lib/narrateMe/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyOwnerUser(req)
    const job = await getNarrateMeJobForUser(params.id, user.username)
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    const body = (await req.json().catch(() => ({}))) as { regenerateSegmentId?: unknown }
    if (typeof body.regenerateSegmentId === 'string' && body.regenerateSegmentId) {
      const saved = await regenerateOneSegment(job, body.regenerateSegmentId)
      return NextResponse.json({ job: saved })
    }
    const saved = await regenerateJobScript(job)
    return NextResponse.json({ job: saved })
  } catch (err) {
    return narrateMeErrorResponse(err)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyOwnerUser(req)
    const job = await getNarrateMeJobForUser(params.id, user.username)
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    const body = (await req.json().catch(() => ({}))) as {
      segments?: Array<{ id: string; text?: string; sourceStart?: number; sourceEnd?: number }>
      order?: string[]
      deleteIds?: string[]
    }
    const saved = await patchScript(job, body)
    return NextResponse.json({ job: saved })
  } catch (err) {
    return narrateMeErrorResponse(err)
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyOwnerUser(req)
    const job = await getNarrateMeJobForUser(params.id, user.username)
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    return NextResponse.json({ script: job.script })
  } catch (err) {
    return narrateMeErrorResponse(err)
  }
}
