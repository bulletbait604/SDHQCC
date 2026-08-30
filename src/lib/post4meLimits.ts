/** Post4Me analyzes a random 5-minute window from a clip of any length/size. */
export const POST4ME_ANALYZE_CHUNK_SECONDS = 5 * 60
export const POST4ME_ANALYZE_CHUNK_MINUTES = POST4ME_ANALYZE_CHUNK_SECONDS / 60
export const POST4ME_CHUNK_SAMPLE_FRAMES = 12

/** @deprecated Analysis window size, not a max upload duration. */
export const POST4ME_CLIP_MAX_DURATION_SECONDS = POST4ME_ANALYZE_CHUNK_SECONDS
export const POST4ME_CLIP_MAX_DURATION_MINUTES = POST4ME_ANALYZE_CHUNK_MINUTES

/** Safety cap if a clip is still uploaded to R2 (client uses frames instead). */
export const POST4ME_CLIP_MAX_BYTES = 80 * 1024 * 1024

export function post4meClipDurationExceededMessage(): string {
  return `Post4Me analyzes a random ${POST4ME_ANALYZE_CHUNK_MINUTES}-minute slice of your file.`
}

export function post4meClipLimitLabel(): string {
  return `any length — we analyze a random ${POST4ME_ANALYZE_CHUNK_MINUTES}-minute slice`
}

export type Post4MeAnalyzeWindow = {
  startSec: number
  durationSec: number
}

export function pickPost4MeAnalyzeWindow(
  durationSeconds: number | null,
  random: () => number = Math.random
): Post4MeAnalyzeWindow {
  const chunk = POST4ME_ANALYZE_CHUNK_SECONDS
  if (durationSeconds == null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { startSec: 0, durationSec: chunk }
  }
  if (durationSeconds <= chunk) {
    return { startSec: 0, durationSec: durationSeconds }
  }
  const maxStart = durationSeconds - chunk
  const unit = Math.min(1, Math.max(0, random()))
  return { startSec: unit * maxStart, durationSec: chunk }
}

export function post4meChunkSampleTimestamps(
  startSec: number,
  durationSec: number,
  count = POST4ME_CHUNK_SAMPLE_FRAMES
): number[] {
  const n = Math.max(2, Math.min(16, Math.round(count)))
  const span = Math.max(0.5, durationSec)
  return Array.from({ length: n }, (_, i) => startSec + (span * i) / (n - 1))
}
