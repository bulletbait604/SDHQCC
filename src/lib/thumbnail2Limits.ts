/** Limits for R&D Thumbnail 2.0 (long-form clip → viral thumb). */
export const THUMBNAIL2_CLIP_MAX_BYTES = 2 * 1024 * 1024 * 1024
export const THUMBNAIL2_CLIP_MAX_BYTES_FREE = 1 * 1024 * 1024 * 1024

/** Free / coin tier — keep shorter to limit Gemini Files cost */
export const THUMBNAIL2_CLIP_MAX_DURATION_FREE_SECONDS = 60 * 60
export const THUMBNAIL2_CLIP_MAX_DURATION_FREE_MINUTES = 60

/** Subscribers / unlimited — up to 2 hours */
export const THUMBNAIL2_CLIP_MAX_DURATION_SUBSCRIBER_SECONDS = 2 * 60 * 60
export const THUMBNAIL2_CLIP_MAX_DURATION_SUBSCRIBER_MINUTES = 120

export function thumbnail2ClipMaxBytes(subscriber: boolean): number {
  return subscriber ? THUMBNAIL2_CLIP_MAX_BYTES : THUMBNAIL2_CLIP_MAX_BYTES_FREE
}

export function thumbnail2ClipMaxDurationSeconds(subscriber: boolean): number {
  return subscriber
    ? THUMBNAIL2_CLIP_MAX_DURATION_SUBSCRIBER_SECONDS
    : THUMBNAIL2_CLIP_MAX_DURATION_FREE_SECONDS
}

export function formatThumbnail2ClipLimitLabel(subscriber: boolean): string {
  const minutes = subscriber
    ? THUMBNAIL2_CLIP_MAX_DURATION_SUBSCRIBER_MINUTES
    : THUMBNAIL2_CLIP_MAX_DURATION_FREE_MINUTES
  const gb = subscriber ? 2 : 1
  return `Up to ${minutes} min · ${gb} GB max`
}

export function thumbnail2ClipDurationExceededMessage(subscriber: boolean): string {
  if (subscriber) {
    return `Clip must be ${THUMBNAIL2_CLIP_MAX_DURATION_SUBSCRIBER_MINUTES} minutes (2 hours) or shorter.`
  }
  return `Clips are limited to ${THUMBNAIL2_CLIP_MAX_DURATION_FREE_MINUTES} minutes on the free tier. Subscribe for uploads up to 2 hours.`
}

/** Video understanding — Flash-Lite keeps long-clip analysis cheap. */
export const THUMBNAIL2_VIDEO_MODEL_DEFAULT = 'gemini-2.5-flash-lite'
/** Image paint — native Gemini image model for overlays / stickers on the frame. */
export const THUMBNAIL2_IMAGE_MODEL_DEFAULT = 'gemini-2.5-flash-image'
