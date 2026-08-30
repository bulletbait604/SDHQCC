import {
  generatePresignedReadUrl,
  putBufferToR2,
} from '@/lib/r2'
import { spendToolCoins, refundToolCoins } from '@/lib/coins/spendToolCoins'
import type { VerifiedUser } from '@/lib/auth/verifyAuth'
import { assembleViralClipIfNeeded } from '@/lib/viralClipGen/assemble'
import {
  VIRAL_CLIP_ASPECT_RATIO,
  VIRAL_CLIP_MAX_IMAGE_BYTES,
  VIRAL_CLIP_MAX_REFERENCE_IMAGES,
  VIRAL_CLIP_MODEL_MAX_REFERENCE_IMAGES,
  isAllowedViralClipImageType,
  isViralClipDuration,
  normalizeViralClipPrompt,
  type ViralClipDuration,
} from '@/lib/viralClipGen/config'
import { VIRAL_CLIP_GEN_TOOL, viralClipGenCoinCost } from '@/lib/viralClipGen/costs'
import { generateVideo } from '@/lib/viralClipGen/falVideo'
import {
  createViralClipJob,
  newViralClipJobId,
  updateViralClipJob,
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
    const url = await generatePresignedReadUrl(key, 3600)
    if (!url) throw new Error('Could not prepare a reference image for the video model.')
    urls.push(url)
  }

  const passed = urls.slice(0, VIRAL_CLIP_MODEL_MAX_REFERENCE_IMAGES)
  const extra = refs.length - passed.length
  const notes =
    extra > 0
      ? `All ${refs.length} images were used in the Gemini plan. The video model used ${passed.length} as start/end frames.`
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

export async function runViralClipPipeline(params: {
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

    await updateViralClipJob(jobId, {
      status: 'generating',
      generatedPrompt: plan.falPrompt,
      referenceNotes: [staged.notes, plan.referenceNotes].filter(Boolean).join(' '),
      model: plan.rawModel,
    })

    const segmentUrls: string[] = []
    let falModel = ''
    for (const segment of plan.segments) {
      const generated = await generateVideo({
        prompt: segment.prompt || plan.falPrompt,
        negativePrompt: plan.negativePrompt,
        duration: segment.duration,
        aspectRatio: VIRAL_CLIP_ASPECT_RATIO,
        referenceImageUrls: staged.urls,
      })
      falModel = generated.model
      segmentUrls.push(generated.videoUrl)
    }

    await updateViralClipJob(jobId, { status: 'rendering', model: falModel })

    const assembledUrl = await assembleViralClipIfNeeded({
      segmentUrls,
      segmentDurations: plan.segments.map((s) => s.duration),
    })

    const buffer = await downloadVideo(assembledUrl)
    const stored = await storeBufferAsMp4({
      username: params.user.username,
      jobId,
      buffer,
    })

    const videoUrl = `/api/image?key=${encodeURIComponent(stored.key)}`
    const complete: Partial<ViralClipJob> = {
      status: 'complete',
      videoKey: stored.key,
      videoUrl,
      model: falModel,
      generatedPrompt: plan.falPrompt,
      referenceNotes: [staged.notes, plan.referenceNotes].filter(Boolean).join(' '),
      error: '',
    }
    await updateViralClipJob(jobId, complete)

    return {
      job: { ...job, ...complete, status: 'complete' } as ViralClipJob,
      remainingCoins: spend.remainingCoins,
      unlimited: spend.unlimited,
    }
  } catch (err) {
    const message = userFacingError(err)
    try {
      await updateViralClipJob(jobId, { status: 'failed', error: message })
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
