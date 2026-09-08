import { createHash } from 'crypto'

export const NARRATE_ME_TOOL = 'narrate-me' as const
export const NARRATE_ME_COIN_COST = 8
export const NARRATE_ME_MAX_DURATION_SECONDS = 2 * 60 * 60
export const NARRATE_ME_MAX_BYTES = 12 * 1024 * 1024 * 1024
export const NARRATE_ME_UPLOAD_EXPIRES_IN = 7200
export const NARRATE_ME_ANALYSIS_CHUNK_SECONDS = 480
export const NARRATE_ME_ANALYSIS_OVERLAP_SECONDS = 8
export const NARRATE_ME_VOICE_BATCH = 4
export const NARRATE_ME_LOCAL_ASSEMBLE_MAX_SECONDS = 20 * 60
export const NARRATE_ME_SAMPLE_RATE = 44100
export const ELEVENLABS_PCM_FORMAT = 'pcm_44100'

export const NARRATE_ME_ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
] as const

export function narrateMeGeminiModel(): string {
  return (
    process.env.NARRATE_ME_GEMINI_MODEL?.trim() ||
    process.env.THUMBNAIL_VIDEO_GEMINI_MODEL?.trim() ||
    'gemini-3.1-flash-lite'
  )
}

export function narrateMeGeminiApiKey(): string {
  return (
    process.env.GEMINI_API?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    ''
  )
}

export function elevenLabsApiKey(): string {
  return (
    process.env.ELEVEN_LABS_API?.trim() ||
    process.env.ELEVEN_LAB_API?.trim() ||
    ''
  )
}

export function elevenLabsVoiceId(): string {
  return process.env.ELEVENLABS_VOICE_ID?.trim() || ''
}

export function sanitizeUserSeg(username: string): string {
  return username.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 64) || 'user'
}

export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() || 'video.mp4'
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160)
}

export function extFromFilename(filename: string, mimeType: string): string {
  const name = sanitizeFilename(filename)
  const fromName = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('quicktime')) return 'mov'
  if (mimeType.includes('matroska')) return 'mkv'
  return 'mp4'
}

export function hashNarrationText(text: string): string {
  return createHash('sha256').update(text.trim().replace(/\s+/g, ' ')).digest('hex').slice(0, 16)
}

export function analysisCacheKey(fileKey: string, sizeBytes: number, durationSeconds: number): string {
  return createHash('sha256')
    .update(`${fileKey}:${sizeBytes}:${Math.round(durationSeconds)}`)
    .digest('hex')
    .slice(0, 24)
}

export function scriptCacheKey(timelineIds: string[], prompt: string): string {
  return createHash('sha256')
    .update(`${timelineIds.join(',')}|${prompt.trim()}`)
    .digest('hex')
    .slice(0, 24)
}

export type AnalysisWindow = {
  index: number
  startTime: number
  endTime: number
}

export function analysisWindows(durationSeconds: number): AnalysisWindow[] {
  const duration = Math.max(1, Math.min(NARRATE_ME_MAX_DURATION_SECONDS, durationSeconds))
  const span = NARRATE_ME_ANALYSIS_CHUNK_SECONDS
  const overlap = NARRATE_ME_ANALYSIS_OVERLAP_SECONDS
  const step = Math.max(30, span - overlap)
  const windows: AnalysisWindow[] = []
  let start = 0
  let index = 0
  while (start < duration) {
    const end = Math.min(duration, start + span)
    windows.push({ index, startTime: roundTs(start), endTime: roundTs(end) })
    if (end >= duration) break
    start += step
    index += 1
  }
  return windows
}

export function roundTs(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value * 10) / 10
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function formatSrtTime(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000))
  const h = Math.floor(totalMs / 3_600_000)
  const m = Math.floor((totalMs % 3_600_000) / 60_000)
  const s = Math.floor((totalMs % 60_000) / 1000)
  const ms = totalMs % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

export function formatVttTime(seconds: number): string {
  return formatSrtTime(seconds).replace(',', '.')
}

export function isAllowedNarrateMeVideoType(mimeType: string): boolean {
  const mime = mimeType.toLowerCase().split(';')[0]!.trim()
  return (NARRATE_ME_ALLOWED_VIDEO_TYPES as readonly string[]).includes(mime)
}

function geminiErrorFields(message: string): { message?: string; status?: string; code?: number } | null {
  const start = message.indexOf('{"error"')
  const jsonText = start >= 0 ? message.slice(start) : message
  try {
    const parsed = JSON.parse(jsonText) as {
      error?: { message?: string; status?: string; code?: number }
    }
    return parsed.error || null
  } catch {
    return null
  }
}

export function userFacingNarrateMeError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Narrate Me failed'
  const gemini = geminiErrorFields(message)
  const combined = `${message} ${gemini?.message || ''} ${gemini?.status || ''}`
  if (/GEMINI_API|not configured/i.test(message)) {
    return 'This tool is not fully configured on the server yet. Ask staff to set the API keys.'
  }
  if (
    gemini?.code === 403 ||
    /PERMISSION_DENIED|does not have permission/i.test(combined)
  ) {
    return 'Gemini could not read this video. Retry analysis — completed work is kept.'
  }
  if (/too large for analysis/i.test(message)) return message
  if (/ELEVEN_LAB|ELEVENLABS_VOICE/i.test(message)) {
    return 'Voice generation is not configured. Set ELEVEN_LABS_API and ELEVENLABS_VOICE_ID.'
  }
  if (/modal/i.test(message) && /not configured|not deployed/i.test(message)) {
    return 'Audio assembly worker is not deployed yet. Deploy the Narrate Me Modal worker.'
  }
  if (/FFmpeg is not installed|winget install Gyan\.FFmpeg/i.test(message)) {
    return message
  }
  if (/Redeploy the Narrate Me Modal|Full-video analysis needs the Modal/i.test(message)) {
    return message
  }
  if (/timeout|timed out/i.test(message)) return 'This step timed out. Retry — completed work is kept.'
  if (message.length > 220) return 'Something failed. Retry this step — completed work is kept.'
  return message
}
