import { NextRequest, NextResponse } from 'next/server'
import {
  INTERNAL_API_SECRET_HEADER,
  isValidInternalApiSecret,
} from '@/lib/internalApi'
import { getNarrateMeJobById, updateNarrateMeJob } from '@/lib/narrateMe/history'
import { applyProgress } from '@/lib/narrateMe/progress'

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  if (isValidInternalApiSecret(req.headers.get(INTERNAL_API_SECRET_HEADER))) return true
  const bearer = req.headers.get('authorization') || ''
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : ''
  const secret = process.env.INTERNAL_API_SECRET?.trim() || process.env.MODAL_SECRET?.trim() || ''
  return !!secret && !!token && token === secret
}

/** Modal worker callback — never returns secrets. */
export async function POST(req: NextRequest) {
  try {
    if (!authorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: unknown
      ok?: unknown
      error?: unknown
      wavKey?: unknown
      mp3Key?: unknown
      srtKey?: unknown
      vttKey?: unknown
      packageKey?: unknown
    }
    const jobId = typeof body.jobId === 'string' ? body.jobId : ''
    const job = await getNarrateMeJobById(jobId)
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })

    if (body.ok === false) {
      const error = typeof body.error === 'string' ? body.error.slice(0, 300) : 'Audio assembly failed'
      const failed = {
        ...job,
        status: 'failed' as const,
        error,
        retryable: true,
        audio: { ...job.audio, status: 'failed' as const },
      }
      const progress = applyProgress(failed)
      await updateNarrateMeJob(jobId, { ...failed, ...progress })
      return NextResponse.json({ ok: false })
    }

    const wavKey = typeof body.wavKey === 'string' ? body.wavKey : job.audio.wavKey
    const mp3Key = typeof body.mp3Key === 'string' ? body.mp3Key : job.audio.mp3Key
    const srtKey = typeof body.srtKey === 'string' ? body.srtKey : job.captions.srtKey
    const vttKey = typeof body.vttKey === 'string' ? body.vttKey : job.captions.vttKey
    const packageKey = typeof body.packageKey === 'string' ? body.packageKey : job.export.packageKey
    const ready = {
      ...job,
      status: 'ready' as const,
      error: '',
      audio: { status: 'complete' as const, wavKey, mp3Key },
      captions: { status: 'complete' as const, srtKey, vttKey },
      export: { status: 'complete' as const, packageKey },
    }
    const progress = applyProgress(ready)
    await updateNarrateMeJob(jobId, { ...ready, ...progress })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[narrate-me/callback]', err)
    return NextResponse.json({ error: 'Callback failed' }, { status: 500 })
  }
}
