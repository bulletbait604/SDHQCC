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

/**
 * Provider-backed video generation. Swap models in viralClipGen/config.ts.
 * Extra reference URLs beyond the model's native limit are already baked into the Gemini plan.
 */
export async function generateVideo(params: FalVideoGenerateInput): Promise<FalVideoGenerateResult> {
  const key = falKey()
  fal.config({ credentials: key })
  const models = viralClipGenModels()
  const duration = String(params.duration === 10 ? 10 : 5)
  const refs = params.referenceImageUrls.filter((u) => u.startsWith('http'))

  const model = refs.length > 0 ? models.imageToVideo : models.textToVideo
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    duration,
    aspect_ratio: params.aspectRatio,
  }
  if (params.negativePrompt) input.negative_prompt = params.negativePrompt

  if (refs[0]) input.image_url = refs[0]
  if (refs[1]) {
    input.tail_image_url = refs[1]
    input.image_tail_url = refs[1]
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
    if (refs.length > 1) {
      const retry = { ...input }
      delete retry.tail_image_url
      delete retry.image_tail_url
      try {
        const videoUrl = await run(retry)
        return { videoUrl, model }
      } catch {
        /* fall through */
      }
    }
    console.error('[viral-clip-gen] fal generate failed:', err)
    throw new Error('Video generation failed. Try a simpler prompt or fewer reference images.')
  }
}
