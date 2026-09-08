import { NextRequest, NextResponse } from 'next/server'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { narrateMeErrorResponse } from '@/lib/narrateMe/http'
import { getNarrateMeJobForUser, markUploaded, publicJob, startAnalysis } from '@/lib/narrateMe/pipeline'
import { getR2ObjectMetadata } from '@/lib/r2'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyOwnerUser(req)
    let job = await getNarrateMeJobForUser(params.id, user.username)
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    if (!job.sourceVideo.uploadedAt) {
      const meta = await getR2ObjectMetadata(job.sourceVideo.fileKey)
      if (!meta) {
        return NextResponse.json({ error: 'Upload the video to storage first.' }, { status: 409 })
      }
      job = await markUploaded(job, meta.contentLength)
    }
    const saved = await startAnalysis(job, user)
    return NextResponse.json({ job: publicJob(saved) })
  } catch (err) {
    return narrateMeErrorResponse(err)
  }
}
