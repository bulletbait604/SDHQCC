const MAX_PROMPT_CHARS = 400

export function cleanBannerPrompt(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PROMPT_CHARS)
}

/**
 * Empty prompt keeps the current edge-fill instruction and pastes the original photo back.
 * A user prompt is an edit, so the generated picture is the banner.
 */
export function buildBannerAiInstruction(input: {
  userPrompt: string
  width: number
  height: number
}): { text: string; keepsOriginalSubject: boolean } {
  const prompt = cleanBannerPrompt(input.userPrompt)
  if (!prompt) {
    return {
      keepsOriginalSubject: true,
      text: [
        'Extend this banner to the edges of the frame.',
        `The frame is ${input.width} by ${input.height} pixels.`,
        'The photograph is already placed in the frame. Do not move, crop, stretch, or redraw the existing subject, face, logo, or text.',
        'Paint only the flat empty margins so the scene continues. Do not add words, logos, watermarks, or a border.',
        'Return one image with the same aspect ratio as the input.',
      ].join(' '),
    }
  }
  return {
    keepsOriginalSubject: false,
    text: [
      'Edit this banner image.',
      `The frame is ${input.width} by ${input.height} pixels.`,
      `The user asked: ${prompt}`,
      'Follow that request. Keep the same aspect ratio as the input.',
      'Do not add a watermark or a border. Do not add words unless the user asked for text.',
      'Return one image.',
    ].join(' '),
  }
}
