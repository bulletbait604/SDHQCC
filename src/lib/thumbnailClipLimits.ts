/** Shared limits for Thumbnail Generator reference clips. */
export const THUMBNAIL_CLIP_MAX_GB = 3.5
export const THUMBNAIL_CLIP_MAX_BYTES = THUMBNAIL_CLIP_MAX_GB * 1024 * 1024 * 1024

/** Full-video Gemini analysis via R2 URL. Larger clips use client frame samples instead. */
export const THUMBNAIL_CLIP_SERVER_VIDEO_MAX_BYTES = 80 * 1024 * 1024

/** Free / coin tier */
export const THUMBNAIL_CLIP_MAX_DURATION_FREE_SECONDS = 30 * 60
export const THUMBNAIL_CLIP_MAX_DURATION_FREE_MINUTES = 30

/** Monthly subscription (unlimited access) */
export const THUMBNAIL_CLIP_MAX_DURATION_SUBSCRIBER_SECONDS = 90 * 60
export const THUMBNAIL_CLIP_MAX_DURATION_SUBSCRIBER_MINUTES = 90

/** @deprecated Use thumbnailClipMaxDurationSeconds(subscriber) */
export const THUMBNAIL_CLIP_MAX_DURATION_SECONDS = THUMBNAIL_CLIP_MAX_DURATION_FREE_SECONDS
export const THUMBNAIL_CLIP_MAX_DURATION_MINUTES = THUMBNAIL_CLIP_MAX_DURATION_FREE_MINUTES

export function thumbnailClipMaxDurationSeconds(subscriber: boolean): number {
  return subscriber
    ? THUMBNAIL_CLIP_MAX_DURATION_SUBSCRIBER_SECONDS
    : THUMBNAIL_CLIP_MAX_DURATION_FREE_SECONDS
}

export function formatThumbnailClipLimitLabel(subscriber: boolean): string {
  const minutes = subscriber
    ? THUMBNAIL_CLIP_MAX_DURATION_SUBSCRIBER_MINUTES
    : THUMBNAIL_CLIP_MAX_DURATION_FREE_MINUTES
  return `Up to ${minutes} min · ${THUMBNAIL_CLIP_MAX_GB} GB max`
}

export function thumbnailClipSizeExceededMessage(): string {
  return `Clip must be under ${THUMBNAIL_CLIP_MAX_GB} GB. Compress long VODs before uploading.`
}

export const THUMBNAIL_CLIP_SUBSCRIBER_UPSELL =
  'Upload up to 90-minute videos with a monthly subscription.'

export function thumbnailClipDurationExceededMessage(subscriber: boolean): string {
  if (subscriber) {
    return `Clip must be ${THUMBNAIL_CLIP_MAX_DURATION_SUBSCRIBER_MINUTES} minutes or shorter.`
  }
  return `Clips are limited to ${THUMBNAIL_CLIP_MAX_DURATION_FREE_MINUTES} minutes. ${THUMBNAIL_CLIP_SUBSCRIBER_UPSELL}`
}
