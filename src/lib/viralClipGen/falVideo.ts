import { fal } from '@fal-ai/client'
import { VIRAL_CLIP_ASPECT_RATIO, viralClipGenModels } from '@/lib/viralClipGen/config'

export type FalVideoGenerateInput = {
  prompt: string
  negativePrompt?: string
  duration: number
  aspectRatio: typeof VIRAL_CLIP_ASPECT_RATIO
  referenceImageUrls: string[]
}

export type FalVideoGenerateResult = {
  videoUrl: string
  model: string
}

function falKey(): string {
  const key = (process.env.FAL_KEY || process.env.FAL_API_KEY || '').trim()
  if (!key) throw new Error('FAL_KEY is not configured')
  return key
}

function findVideoUrl(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const rec = data as Record<string, unknown>
  if (rec.video && typeof rec.video === 'object') {
    const v = rec.video as Record<string, unknown>
    if (typeof v.url === 'string' && v.url.startsWith('http')) return v.url
  }
  if (typeof rec.video_url === 'string' && rec.video_url.startsWith('http')) return rec.video_url
  if (typeof rec.url === 'string' && rec.url.startsWith('http')) return rec.url
  return ''
}

function stripDataUrl(raw: string): { mime: string; bytes: Buffer } | null {
  const match = raw.trim().match(/^data:([^;]+);base64,(.+)$/i)
  if (!match) return null
  try {
    return { mime: match[1]!.trim(), bytes: Buffer.from(match[2]!, 'base64') }
  } catch {
    return null
  }
}

function describeFalError(err: unknown): string {
  if (!err || typeof err !== 'object') return err instanceof Error ? err.message : String(err)
  const rec = err as {
    message?: unknown
    status?: unknown
    body?: { detail?: unknown; message?: unknown }
  }
  const parts: string[] = []
  if (typeof rec.status === 'number') parts.push(`status ${rec.status}`)
  if (typeof rec.message === 'string' && rec.message.trim()) parts.push(rec.message.trim())
  const detail = rec.body?.detail
  if (typeof detail === 'string' && detail.trim()) parts.push(detail.trim())
  if (Array.isArray(detail)) {
    for (const item of detail.slice(0, 4)) {
      if (typeof item === 'string' && item.trim()) parts.push(item.trim())
      else if (item && typeof item === 'object') {
        const row = item as { loc?: unknown; msg?: unknown; type?: unknown }
        const loc = Array.isArray(row.loc) ? row.loc.map(String).join('.') : ''
        const msg = typeof row.msg === 'string' ? row.msg : ''
        if (msg) parts.push(loc ? `${loc}: ${msg}` : msg)
      }
    }
  }
  if (typeof rec.body?.message === 'string' && rec.body.message.trim()) {
    parts.push(rec.body.message.trim())
  }
  return parts.join(' — ').slice(0, 500)
}

async function resolveImageUrl(raw: string): Promise<string> {
  const trimmed = raw.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  const parsed = stripDataUrl(trimmed)
  if (!parsed || parsed.bytes.length < 32) {
    throw new Error('Reference image was invalid.')
  }
  const blob = new Blob([new Uint8Array(parsed.bytes)], { type: parsed.mime || 'image/jpeg' })
  return fal.storage.upload(blob)
}

/**
 * Provider-backed video generation. Swap models in viralClipGen/config.ts.
 *
 * Kling 2.1 Standard is image-to-video only (no T2V endpoint).
 * Text-to-video uses Kling 1.6 Standard, which supports 9:16 and 5s/10s.
 */
export async function generateVideo(params: FalVideoGenerateInput): Promise<FalVideoGenerateResult> {
  const key = falKey()
  fal.config({ credentials: key })
  const models = viralClipGenModels()
  const duration = params.duration === 10 ? '10' : '5'
  const refs = params.referenceImageUrls.filter((u) => typeof u === 'string' && u.trim())

  const hasRefs = refs.length > 0
  const model = hasRefs ? models.imageToVideo : models.textToVideo

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    duration,
  }
  if (params.negativePrompt) input.negative_prompt = params.negativePrompt
  input.cfg_scale = 0.5

  if (hasRefs) {
    input.image_url = await resolveImageUrl(refs[0]!)
  } else {
    input.aspect_ratio = params.aspectRatio
  }

  const run = async (payload: Record<string, unknown>) => {
    const result = await fal.subscribe(model, {
      input: payload,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          for (const log of update.logs ?? []) {
            console.log('[viral-clip-gen][fal]', log.message)
          }
        }
      },
    })
    const url =
      findVideoUrl((result as { data?: unknown }).data) || findVideoUrl(result)
    if (!url) throw new Error('Video generation returned no file.')
    return url
  }

  try {
    const videoUrl = await run(input)
    return { videoUrl, model }
  } catch (err) {
    const detail = describeFalError(err)
    console.error('[viral-clip-gen] fal generate failed:', { model, duration, hasRefs, detail, err })
    if (/not found|404|unknown endpoint|does not exist/i.test(detail)) {
      throw new Error('Video generation failed. The selected video model is not available.')
    }
    if (/unauthor|401|403|invalid.*key|forbidden/i.test(detail)) {
      throw new Error('Video generation failed. The video API key was rejected.')
    }
    if (/image|download|fetch|url/i.test(detail) && hasRefs) {
      throw new Error('Video generation failed. The reference image could not be used. Try a smaller JPG or PNG.')
    }
    if (/unprocessable|422|extra_forbidden|unexpected/i.test(detail)) {
      throw new Error('Video generation failed. The request was rejected by the video model.')
    }
    throw new Error('Video generation failed. Try a simpler prompt or fewer reference images.')
  }
}
