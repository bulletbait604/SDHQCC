export const BANNER_PROMPT_MAX = 500

/** Keep the edit request on one line and inside the size the image route will send. */
export function sanitizeBannerPrompt(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, BANNER_PROMPT_MAX)
}

/**
 * The Gemini instruction for AI Fill. The user's text steers the edit.
 * The original photo is still pasted back on top after the model returns.
 */
export function buildFillPrompt(width: number, height: number, userPrompt: string): string {
  const request = sanitizeBannerPrompt(userPrompt) || 'Continue the existing scene naturally.'
  return [
    'Extend this banner to the edges of the frame.',
    `The frame is ${width} by ${height} pixels.`,
    'The photograph is already placed in the frame. Do not move, crop, stretch, or redraw the existing subject, face, logo, or text.',
    'Paint the empty margins so the scene continues.',
    `Edit request from the creator: ${request}`,
    'Follow that edit request in the painted margins. Do not add words, logos, watermarks, or a border unless the edit request explicitly asks for them.',
    'Return one image with the same aspect ratio as the input.',
  ].join(' ')
}
