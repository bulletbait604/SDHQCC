import { NextRequest, NextResponse } from 'next/server'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { narrateMeErrorResponse } from '@/lib/narrateMe/http'
import { createUploadJob } from '@/lib/narrateMe/pipeline'
import { listNarrateMeJobsForUser } from '@/lib/narrateMe/history'
import { isAllowedNarrateMeVideoType } from '@/lib/narrateMe/config'
import { generateUploadUrl } from '@/lib/r2'
import { NARRATE_ME_COIN_COST, NARRATE_ME_UPLOAD_EXPIRES_IN } from '@/lib/narrateMe/config'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const user = await verifyOwnerUser(req)
    const body = (await req.json().catch(() => ({}))) as {
      prompt?: unknown
      filename?: unknown
      contentType?: unknown
      durationSeconds?: unknown
    }
    const filename = typeof body.filename === 'string' ? body.filename : 'video.mp4'
    const contentType =
      typeof body.contentType === 'string'
        ? body.contentType.toLowerCase().split(';')[0]!.trim()
        : 'video/mp4'
    if (!isAllowedNarrateMeVideoType(contentType)) {
      return NextResponse.json({ error: 'Upload a video file (mp4, webm, mov, mkv, avi).' }, { status: 400 })
    }
    const durationSeconds =
      typeof body.durationSeconds === 'number' ? body.durationSeconds : Number(body.durationSeconds) || 0
    const job = await createUploadJob({
      user,
      prompt: typeof body.prompt === 'string' ? body.prompt : '',
      fileName: filename,
      mimeType: contentType,
      durationSeconds,
    })
    const upload = await generateUploadUrl(filename, contentType, {
      clipUsername: user.username,
      purpose: 'narrate-me',
      jobId: job.jobId,
      fileKey: job.sourceVideo.fileKey,
      expiresIn: NARRATE_ME_UPLOAD_EXPIRES_IN,
    })
    if (!upload) {
      return NextResponse.json({ error: 'R2 is not configured.' }, { status: 500 })
    }
    return NextResponse.json({
      job,
      uploadUrl: upload.uploadUrl,
      fileKey: upload.fileKey,
      expiresIn: NARRATE_ME_UPLOAD_EXPIRES_IN,
      coinCost: NARRATE_ME_COIN_COST,
    })
  } catch (err) {
    return narrateMeErrorResponse(err)
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyOwnerUser(req)
    const jobs = await listNarrateMeJobsForUser(user.username, 20)
    return NextResponse.json({ jobs, coinCost: NARRATE_ME_COIN_COST })
  } catch (err) {
    return narrateMeErrorResponse(err)
  }
}
