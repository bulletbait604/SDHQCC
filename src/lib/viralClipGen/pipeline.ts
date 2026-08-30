import {
  putBufferToR2,
} from '@/lib/r2'
import { spendToolCoins, refundToolCoins } from '@/lib/coins/spendToolCoins'
import type { VerifiedUser } from '@/lib/auth/verifyAuth'
import {
  VIRAL_CLIP_ASPECT_RATIO,
  VIRAL_CLIP_JOB_STALE_MS,
  VIRAL_CLIP_MAX_IMAGE_BYTES,
  VIRAL_CLIP_MAX_REFERENCE_IMAGES,
  VIRAL_CLIP_MODEL_MAX_REFERENCE_IMAGES,
  isAllowedViralClipImageType,
  isViralClipDuration,
  normalizeViralClipPrompt,
  type ViralClipDuration,
} from '@/lib/viralClipGen/config'
import { VIRAL_CLIP_GEN_TOOL, viralClipGenCoinCost } from '@/lib/viralClipGen/costs'
import {
  getQueuedVideoStatus,
  getQueuedVideoUrl,
  submitVideo,
} from '@/lib/viralClipGen/falVideo'
import { checkViralClipAssembly, submitViralClipAssembly } from '@/lib/viralClipGen/assemble'
import {
  claimViralClipJobStatus,
  createViralClipJob,
  getViralClipJobForUser,
  newViralClipJobId,
  updateViralClipJob,
  type ViralClipFalSegment,
  type ViralClipJob,
} from '@/lib/viralClipGen/history'
import { planViralClip, type ViralClipReference } from '@/lib/viralClipGen/plan'

export type ViralClipGenerateInput = {
  prompt: string
  duration: ViralClipDuration
  references: ViralClipReference[]
}

export type ViralClipGenerateResult = {
  job: ViralClipJob
  remainingCoins: number
  unlimited: boolean
  userMessage?: string
}

function sanitizeUser(username: string): string {
  return username.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 64) || 'user'
}

function userFacingError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Generation failed'
  if (/gemini_api|fal_key|shotstack|not configured/i.test(message)) {
    return 'This tool is not fully configured on the server yet. Ask staff to set the API keys.'
  }
  if (/timeout|timed out/i.test(message)) return 'Generation timed out. Try a shorter clip or retry.'
  if (/insufficient|insufficient coins/i.test(message)) return 'Not enough coins for this clip length.'
  if (message.length > 180) return 'Generation failed. Try a clearer prompt or fewer images.'
  return message
}

async function storeBufferAsMp4(params: {
  username: string
  jobId: string
  buffer: Buffer
}): Promise<{ key: string }> {
  const key = `uploads/viral-clip-gen/${sanitizeUser(params.username)}/${params.jobId}.mp4`
  const ok = await putBufferToR2(key, params.buffer, 'video/mp4')
  if (!ok) throw new Error('Could not save the finished video.')
  return { key }
}

async function downloadVideo(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not download the generated video.')
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 1000) throw new Error('Generated video file was empty.')
  return buf
}

async function stageReferenceUrls(
  jobId: string,
  username: string,
  refs: ViralClipReference[]
): Promise<{ urls: string[]; notes: string }> {
  if (refs.length === 0) return { urls: [], notes: 'No reference images.' }

  const urls: string[] = []
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i]!
    const ext = ref.mimeType.includes('png') ? 'png' : ref.mimeType.includes('webp') ? 'webp' : 'jpg'
    const key = `uploads/viral-clip-gen/${sanitizeUser(username)}/${jobId}-ref-${i}.${ext}`
    const raw = Buffer.from(ref.base64.replace(/^data:[^;]+;base64,/, ''), 'base64')
    if (raw.length > VIRAL_CLIP_MAX_IMAGE_BYTES) {
      throw new Error('Each reference image must be under 8MB.')
    }
    const ok = await putBufferToR2(key, raw, ref.mimeType || 'image/jpeg')
    if (!ok) throw new Error('Could not store a reference image.')
    const mime = ref.mimeType || 'image/jpeg'
    urls.push(`data:${mime};base64,${raw.toString('base64')}`)
  }

  const passed = urls.slice(0, VIRAL_CLIP_MODEL_MAX_REFERENCE_IMAGES)
  const extra = refs.length - passed.length
  const notes =
    extra > 0
      ? `All ${refs.length} images were used in the Gemini plan. The video model used the first image as the start frame.`
      : `Used ${refs.length} reference image${refs.length === 1 ? '' : 's'} in the video model.`

  return { urls: passed, notes }
}

export function validateViralClipInput(body: {
  prompt?: unknown
  duration?: unknown
  references?: unknown
}): { prompt: string; duration: ViralClipDuration; references: ViralClipReference[] } {
  const prompt = normalizeViralClipPrompt(body.prompt)
  if (prompt.length < 8) {
    throw Object.assign(new Error('Describe the video you want (at least a short sentence).'), {
      status: 400,
    })
  }

  const durationRaw =
    typeof body.duration === 'string' ? Number(body.duration) : body.duration
  if (!isViralClipDuration(durationRaw)) {
    throw Object.assign(new Error('Choose 5, 10, 15, 20, or 30 seconds.'), { status: 400 })
  }

  const refsIn = Array.isArray(body.references) ? body.references : []
  if (refsIn.length > VIRAL_CLIP_MAX_REFERENCE_IMAGES) {
    throw Object.assign(new Error(`You can attach up to ${VIRAL_CLIP_MAX_REFERENCE_IMAGES} images.`), {
      status: 400,
    })
  }

  const references: ViralClipReference[] = []
  for (const item of refsIn) {
    if (!item || typeof item !== 'object') {
      throw Object.assign(new Error('One of the reference images is invalid.'), { status: 400 })
    }
    const rec = item as { base64?: unknown; mimeType?: unknown }
    if (typeof rec.base64 !== 'string' || !rec.base64.trim()) {
      throw Object.assign(new Error('One of the reference images is invalid.'), { status: 400 })
    }
    const mime =
      typeof rec.mimeType === 'string' ? rec.mimeType.toLowerCase().split(';')[0]!.trim() : ''
    if (!isAllowedViralClipImageType(mime)) {
      throw Object.assign(new Error('Reference images must be PNG, JPG, WebP, or GIF.'), {
        status: 400,
      })
    }
    references.push({ base64: rec.base64, mimeType: mime === 'image/jpg' ? 'image/jpeg' : mime })
  }

  return { prompt, duration: durationRaw, references }
}

async function failJob(
  user: VerifiedUser,
  job: ViralClipJob,
  message: string
): Promise<ViralClipJob> {
  await updateViralClipJob(job.id, { status: 'failed', error: message })
  if (job.creditCost > 0 && !job.refunded) {
    try {
      await refundToolCoins(user, VIRAL_CLIP_GEN_TOOL, job.creditCost)
      await updateViralClipJob(job.id, { refunded: true })
    } catch (refundErr) {
      console.error('[viral-clip-gen] refund failed:', refundErr)
    }
  }
  return { ...job, status: 'failed', error: message, refunded: true }
}

async function finalizeJob(
  user: VerifiedUser,
  job: ViralClipJob,
  sourceUrl: string
): Promise<ViralClipJob> {
  const buffer = await downloadVideo(sourceUrl)
  const stored = await storeBufferAsMp4({
    username: user.username,
    jobId: job.id,
    buffer,
  })
  const videoUrl = `/api/image?key=${encodeURIComponent(stored.key)}`
  const complete: Partial<ViralClipJob> = {
    status: 'complete',
    videoKey: stored.key,
    videoUrl,
    error: '',
  }
  await updateViralClipJob(job.id, complete)
  return { ...job, ...complete, status: 'complete' } as ViralClipJob
}

/** Start Gemini planning + fal queue. Returns quickly so Vercel does not time out. */
export async function startViralClipJob(params: {
  user: VerifiedUser
  prompt: string
  duration: ViralClipDuration
  references: ViralClipReference[]
}): Promise<ViralClipGenerateResult> {
  const cost = viralClipGenCoinCost(params.duration)
  const spend = await spendToolCoins(params.user, VIRAL_CLIP_GEN_TOOL, cost)
  if (!spend.ok) {
    throw Object.assign(
      new Error(
        spend.reason === 'Insufficient coins'
          ? `Not enough coins. This ${params.duration}s clip costs ${cost}.`
          : spend.reason
      ),
      { status: spend.status }
    )
  }

  const now = new Date().toISOString()
  const jobId = newViralClipJobId()
  const job: ViralClipJob = {
    id: jobId,
    userId: params.user.id,
    username: params.user.username.toLowerCase(),
    originalPrompt: params.prompt,
    generatedPrompt: '',
    referenceCount: params.references.length,
    referenceNotes: '',
    duration: params.duration,
    model: '',
    status: 'preparing',
    videoKey: '',
    videoUrl: '',
    creditCost: spend.deducted,
    error: '',
    falSegments: [],
    shotstackRenderId: '',
    refunded: false,
    createdAt: now,
    updatedAt: now,
  }

  try {
    await createViralClipJob(job)

    const staged = await stageReferenceUrls(jobId, params.user.username, params.references)
    const plan = await planViralClip({
      userPrompt: params.prompt,
      duration: params.duration,
      references: params.references,
    })

    const falSegments: ViralClipFalSegment[] = []
    for (const segment of plan.segments) {
      const queued = await submitVideo({
        prompt: segment.prompt || plan.falPrompt,
        negativePrompt: plan.negativePrompt,
        duration: segment.duration,
        aspectRatio: VIRAL_CLIP_ASPECT_RATIO,
        referenceImageUrls: staged.urls,
      })
      falSegments.push({
        requestId: queued.requestId,
        model: queued.model,
        duration: segment.duration,
        videoUrl: '',
      })
    }

    const generating: Partial<ViralClipJob> = {
      status: 'generating',
      generatedPrompt: plan.falPrompt,
      referenceNotes: [staged.notes, plan.referenceNotes].filter(Boolean).join(' '),
      model: falSegments[0]?.model || plan.rawModel,
      falSegments,
      error: '',
    }
    await updateViralClipJob(jobId, generating)

    return {
      job: { ...job, ...generating, status: 'generating' } as ViralClipJob,
      remainingCoins: spend.remainingCoins,
      unlimited: spend.unlimited,
    }
  } catch (err) {
    const message = userFacingError(err)
    try {
      await updateViralClipJob(jobId, { status: 'failed', error: message, refunded: spend.deducted > 0 })
    } catch {
      /* history write is best-effort */
    }
    if (spend.deducted > 0) {
      try {
        await refundToolCoins(params.user, VIRAL_CLIP_GEN_TOOL, spend.deducted)
      } catch (refundErr) {
        console.error('[viral-clip-gen] refund failed:', refundErr)
      }
    }
    const status =
      err && typeof err === 'object' && 'status' in err
        ? Number((err as { status?: unknown }).status)
        : 503
    throw Object.assign(new Error(message), {
      status: status >= 400 && status < 600 ? status : 503,
    })
  }
}

/** Advance a queued fal/Shotstack job. Safe to call repeatedly. */
export async function pollViralClipJob(
  user: VerifiedUser,
  jobId: string
): Promise<ViralClipGenerateResult> {
  const job = await getViralClipJobForUser(jobId, user.username)
  if (!job) {
    throw Object.assign(new Error('Clip not found.'), { status: 404 })
  }
  if (job.status === 'complete' || job.status === 'failed') {
    return { job, remainingCoins: 0, unlimited: false }
  }

  const ageMs = Date.now() - Date.parse(job.createdAt)
  if (Number.isFinite(ageMs) && ageMs > VIRAL_CLIP_JOB_STALE_MS) {
    const failed = await failJob(
      user,
      job,
      'Generation timed out. Try a 5 or 10 second clip.'
    )
    return { job: failed, remainingCoins: 0, unlimited: false }
  }

  try {
    if (job.status === 'rendering' && job.shotstackRenderId) {
      const check = await checkViralClipAssembly(job.shotstackRenderId)
      if (check.pending || !check.url) {
        return { job, remainingCoins: 0, unlimited: false }
      }
      const done = await finalizeJob(user, job, check.url)
      return { job: done, remainingCoins: 0, unlimited: false }
    }

    const segments = [...job.falSegments]
    if (segments.length === 0) {
      const failed = await failJob(user, job, 'Video generation did not start.')
      return { job: failed, remainingCoins: 0, unlimited: false }
    }

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!
      if (seg.videoUrl) continue
      const state = await getQueuedVideoStatus(seg.model, seg.requestId)
      if (state === 'FAILED') {
        const failed = await failJob(
          user,
          job,
          'Video generation failed. Try a simpler prompt or fewer reference images.'
        )
        return { job: failed, remainingCoins: 0, unlimited: false }
      }
      if (state === 'COMPLETED') {
        seg.videoUrl = await getQueuedVideoUrl(seg.model, seg.requestId)
      }
    }
    await updateViralClipJob(job.id, { falSegments: segments })

    if (segments.some((s) => !s.videoUrl)) {
      return {
        job: { ...job, falSegments: segments, status: 'generating' },
        remainingCoins: 0,
        unlimited: false,
      }
    }

    const claimed = await claimViralClipJobStatus(job.id, 'generating', 'rendering')
    if (!claimed) {
      const latest = await getViralClipJobForUser(jobId, user.username)
      return { job: latest || job, remainingCoins: 0, unlimited: false }
    }

    const submitted = await submitViralClipAssembly({
      segmentUrls: segments.map((s) => s.videoUrl),
      segmentDurations: segments.map((s) => s.duration),
    })
    if (submitted.url) {
      const done = await finalizeJob(user, { ...job, status: 'rendering' }, submitted.url)
      return { job: done, remainingCoins: 0, unlimited: false }
    }
    if (!submitted.renderId) throw new Error('Could not start final assembly.')
    await updateViralClipJob(job.id, {
      status: 'rendering',
      shotstackRenderId: submitted.renderId,
      falSegments: segments,
    })
    return {
      job: {
        ...job,
        falSegments: segments,
        status: 'rendering',
        shotstackRenderId: submitted.renderId,
      },
      remainingCoins: 0,
      unlimited: false,
    }
  } catch (err) {
    const message = userFacingError(err)
    const failed = await failJob(user, job, message)
    return { job: failed, remainingCoins: 0, unlimited: false }
  }
}
