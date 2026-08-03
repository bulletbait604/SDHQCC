/** Limits for R&D Thumbnail 2.0 (long-form clip → viral thumb). */
export const THUMBNAIL2_CLIP_MAX_BYTES = 2 * 1024 * 1024 * 1024
export const THUMBNAIL2_CLIP_MAX_BYTES_FREE = 1 * 1024 * 1024 * 1024

/** Hard max for all tiers — keeps Flash-Lite under ~1M video-token context. */
export const THUMBNAIL2_CLIP_MAX_DURATION_SECONDS = 60 * 60
export const THUMBNAIL2_CLIP_MAX_DURATION_MINUTES = 60

export function thumbnail2ClipMaxBytes(subscriber: boolean): number {
  return subscriber ? THUMBNAIL2_CLIP_MAX_BYTES : THUMBNAIL2_CLIP_MAX_BYTES_FREE
}

export function thumbnail2ClipMaxDurationSeconds(_subscriber?: boolean): number {
  return THUMBNAIL2_CLIP_MAX_DURATION_SECONDS
}

export function formatThumbnail2ClipLimitLabel(subscriber: boolean): string {
  const gb = subscriber ? 2 : 1
  return `Up to ${THUMBNAIL2_CLIP_MAX_DURATION_MINUTES} min · ${gb} GB max`
}

export function thumbnail2ClipDurationExceededMessage(_subscriber?: boolean): string {
  return `Clip must be ${THUMBNAIL2_CLIP_MAX_DURATION_MINUTES} minutes or shorter.`
}

/** Video understanding — 3.1 Flash-Lite (2.5 Flash-Lite blocked for new Gemini keys). */
export const THUMBNAIL2_VIDEO_MODEL_DEFAULT = 'gemini-3.1-flash-lite'
/** Image paint — native Gemini image model for overlays / stickers on the frame. */
export const THUMBNAIL2_IMAGE_MODEL_DEFAULT = 'gemini-2.5-flash-image'
