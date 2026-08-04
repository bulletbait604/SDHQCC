/** Post4Me clip upload limits (all users). */
export const POST4ME_CLIP_MAX_DURATION_SECONDS = 5 * 60
export const POST4ME_CLIP_MAX_DURATION_MINUTES = POST4ME_CLIP_MAX_DURATION_SECONDS / 60
export const POST4ME_CLIP_MAX_BYTES = 500 * 1024 * 1024

export function post4meClipDurationExceededMessage(): string {
  return `Post4Me clips must be ${POST4ME_CLIP_MAX_DURATION_MINUTES} minutes or shorter. Trim your clip and try again.`
}

export function post4meClipLimitLabel(): string {
  return `up to ${POST4ME_CLIP_MAX_DURATION_MINUTES} minutes`
}
