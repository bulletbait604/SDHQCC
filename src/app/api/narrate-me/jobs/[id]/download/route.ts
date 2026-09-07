import { NextRequest, NextResponse } from 'next/server'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { narrateMeErrorResponse } from '@/lib/narrateMe/http'
import { getNarrateMeJobForUser } from '@/lib/narrateMe/pipeline'
import { signedOutputUrls } from '@/lib/narrateMe/modal'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyOwnerUser(req)
    const job = await getNarrateMeJobForUser(params.id, user.username)
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    if (job.status !== 'ready' && job.export.status !== 'complete') {
      return NextResponse.json({ error: 'Package is not ready yet.' }, { status: 409 })
    }
    const urls = await signedOutputUrls([
      job.export.packageKey,
      job.audio.wavKey,
      job.audio.mp3Key,
      job.captions.srtKey,
      job.captions.vttKey,
    ])
    return NextResponse.json({
      packageUrl: urls[job.export.packageKey] || '',
      wavUrl: urls[job.audio.wavKey] || '',
      mp3Url: urls[job.audio.mp3Key] || '',
      srtUrl: urls[job.captions.srtKey] || '',
      vttUrl: urls[job.captions.vttKey] || '',
      includesOriginalVideo: false,
    })
  } catch (err) {
    return narrateMeErrorResponse(err)
  }
}
