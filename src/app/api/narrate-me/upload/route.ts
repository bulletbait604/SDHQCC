import { NextRequest, NextResponse } from 'next/server'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { getR2ObjectMetadata, generateUploadUrl } from '@/lib/r2'
import { narrateMeErrorResponse } from '@/lib/narrateMe/http'
import { isAllowedNarrateMeVideoType, NARRATE_ME_UPLOAD_EXPIRES_IN } from '@/lib/narrateMe/config'
import { createUploadJob, getNarrateMeJobForUser, markUploaded } from '@/lib/narrateMe/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Owner-only R&D: presigned R2 PUT for the original video (browser → R2, not through Vercel). */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyOwnerUser(req)
    const body = (await req.json().catch(() => ({}))) as {
      filename?: unknown
      contentType?: unknown
      durationSeconds?: unknown
      prompt?: unknown
      jobId?: unknown
    }
    const filename = typeof body.filename === 'string' ? body.filename : ''
    const contentType = typeof body.contentType === 'string' ? body.contentType.toLowerCase().split(';')[0]!.trim() : ''
    if (!filename || !isAllowedNarrateMeVideoType(contentType)) {
      return NextResponse.json(
        { error: 'Upload a video file (mp4, webm, mov, mkv, avi).' },
        { status: 400 }
      )
    }

    let job = typeof body.jobId === 'string' ? await getNarrateMeJobForUser(body.jobId, user.username) : null
    if (!job) {
      const durationSeconds =
        typeof body.durationSeconds === 'number' && Number.isFinite(body.durationSeconds)
          ? body.durationSeconds
          : Number(body.durationSeconds) || 0
      job = await createUploadJob({
        user,
        prompt: typeof body.prompt === 'string' ? body.prompt : 'Explain exactly what happens in this video.',
        fileName: filename,
        mimeType: contentType,
        durationSeconds,
      })
    }

    const result = await generateUploadUrl(filename, contentType, {
      clipUsername: user.username,
      purpose: 'narrate-me',
      jobId: job.jobId,
      fileKey: job.sourceVideo.fileKey,
      expiresIn: NARRATE_ME_UPLOAD_EXPIRES_IN,
    })
    if (!result) {
      return NextResponse.json({ error: 'R2 is not configured.' }, { status: 500 })
    }

    return NextResponse.json({
      job,
      uploadUrl: result.uploadUrl,
      fileKey: result.fileKey,
      expiresIn: NARRATE_ME_UPLOAD_EXPIRES_IN,
    })
  } catch (err) {
    return narrateMeErrorResponse(err)
  }
}

/** Confirm the R2 object exists after the browser PUT. */
export async function PUT(req: NextRequest) {
  try {
    const user = await verifyOwnerUser(req)
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: unknown
      durationSeconds?: unknown
    }
    const jobId = typeof body.jobId === 'string' ? body.jobId : ''
    const job = await getNarrateMeJobForUser(jobId, user.username)
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    const meta = await getR2ObjectMetadata(job.sourceVideo.fileKey)
    if (!meta) {
      return NextResponse.json({ error: 'Upload not found in storage yet.' }, { status: 409 })
    }
    const durationSeconds =
      typeof body.durationSeconds === 'number' && Number.isFinite(body.durationSeconds)
        ? body.durationSeconds
        : job.sourceVideo.durationSeconds
    job.sourceVideo.durationSeconds = durationSeconds
    const saved = await markUploaded(job, meta.contentLength)
    return NextResponse.json({ job: saved })
  } catch (err) {
    return narrateMeErrorResponse(err)
  }
}
