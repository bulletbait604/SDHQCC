export const VIRAL_CLIP_DURATIONS = [5, 10, 15, 20, 30] as const
export type ViralClipDuration = (typeof VIRAL_CLIP_DURATIONS)[number]

export const VIRAL_CLIP_ASPECT_RATIO = '9:16' as const
export const VIRAL_CLIP_OUTPUT_SIZE = { width: 1080, height: 1920 } as const

export const VIRAL_CLIP_MAX_REFERENCE_IMAGES = 5
export const VIRAL_CLIP_MAX_PROMPT_CHARS = 2000
export const VIRAL_CLIP_MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const VIRAL_CLIP_ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export function isAllowedViralClipImageType(mime: string): boolean {
  const normalized = mime.toLowerCase().split(';')[0]!.trim()
  return (VIRAL_CLIP_ALLOWED_IMAGE_TYPES as readonly string[]).includes(normalized)
}

/** Native clip lengths the fal model can generate in one call. */
export const VIRAL_CLIP_NATIVE_DURATIONS = [5, 10] as const

/** Kling 2.1 Standard I2V takes one start image (`image_url`). Extra refs go to Gemini. */
export const VIRAL_CLIP_MODEL_MAX_REFERENCE_IMAGES = 1

export function viralClipGenModels() {
  return {
    /** 2.1 Standard has no T2V endpoint. 1.6 Standard supports 9:16 and 5s/10s. */
    textToVideo:
      process.env.VIRAL_CLIP_GEN_T2V_MODEL?.trim() ||
      'fal-ai/kling-video/v1.6/standard/text-to-video',
    imageToVideo:
      process.env.VIRAL_CLIP_GEN_I2V_MODEL?.trim() ||
      'fal-ai/kling-video/v2.1/standard/image-to-video',
  }
}

export function viralClipGenGeminiModel(): string {
  return process.env.VIRAL_CLIP_GEN_GEMINI_MODEL?.trim() || 'gemini-2.5-flash'
}

/** Fail jobs still generating after this many ms (Kling can take several minutes). */
export const VIRAL_CLIP_JOB_STALE_MS = 15 * 60 * 1000

export function isViralClipDuration(value: unknown): value is ViralClipDuration {
  return typeof value === 'number' && (VIRAL_CLIP_DURATIONS as readonly number[]).includes(value)
}

/** Split a requested length into native fal clips (longest chunks first). */
export function splitDurationIntoNativeChunks(duration: ViralClipDuration): number[] {
  const natives = [...VIRAL_CLIP_NATIVE_DURATIONS].sort((a, b) => b - a)
  const chunks: number[] = []
  let remaining = duration
  for (const n of natives) {
    while (remaining >= n) {
      chunks.push(n)
      remaining -= n
    }
  }
  if (remaining > 0) chunks.push(natives[natives.length - 1]!)
  return chunks
}

export function normalizeViralClipPrompt(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/\r\n/g, '\n').trim().slice(0, VIRAL_CLIP_MAX_PROMPT_CHARS)
}
