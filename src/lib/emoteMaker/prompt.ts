export const EMOTE_STYLES = [
  {
    id: 'chibi',
    label: 'Chibi',
    instruction: 'chibi character with a large head, a small body, and one clear expression',
  },
  {
    id: 'sticker',
    label: 'Sticker',
    instruction: 'die-cut sticker with a thick clean outline and flat colors',
  },
  {
    id: 'pixel',
    label: 'Pixel',
    instruction: 'crisp pixel art with chunky pixels and a small color palette',
  },
  {
    id: 'clean-line',
    label: 'Clean line',
    instruction: 'clean line art with bold outlines and flat color fills',
  },
] as const

export type EmoteStyleId = (typeof EMOTE_STYLES)[number]['id']

export function isEmoteStyle(value: string): value is EmoteStyleId {
  return EMOTE_STYLES.some((style) => style.id === value)
}

export function buildEmotePrompt(input: {
  prompt: string
  style: string
  transparent: boolean
  hasReference: boolean
}): string {
  const style = EMOTE_STYLES.find((item) => item.id === input.style)
  if (!style) throw new Error('Pick a style.')
  const subject = input.prompt.replace(/\s+/g, ' ').trim()
  if (!subject) throw new Error('Describe the emote first.')
  if (subject.length > 800) throw new Error('Keep the prompt under 800 characters.')

  return [
    'Create one original square chat emote.',
    `Style: ${style.instruction}.`,
    `Subject: ${subject}.`,
    'Make it bold, simple, and high contrast so the silhouette stays readable at 28 pixels.',
    'Center the subject with padding inside the square. No text, letters, watermark, signature, or border.',
    'Do not copy, trace, or reproduce a trademarked or copyrighted character, logo, or celebrity. Invent an original design.',
    input.hasReference
      ? 'A reference image is attached only as a guide for subject, colors, and style. Follow its mood without copying it. If the reference is a copyrighted or trademarked character, do not reproduce it.'
      : 'No reference image is attached.',
    input.transparent
      ? 'Put the subject on a perfectly flat background of pure magenta #FF00FF. Do not use magenta, hot pink, or purple anywhere in the subject. No checkerboard, gradient, shadow, or floor on the background.'
      : 'Use one simple solid background color that fits the style. No checkerboard.',
  ].join(' ')
}
