/** Post4Me clip upload limits (all users). */
export const POST4ME_CLIP_MAX_DURATION_SECONDS = 90
export const POST4ME_CLIP_MAX_BYTES = 500 * 1024 * 1024

export function post4meClipDurationExceededMessage(): string {
  return `Post4Me clips must be ${POST4ME_CLIP_MAX_DURATION_SECONDS} seconds or shorter. Trim your clip and try again.`
}
