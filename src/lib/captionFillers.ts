/**
 * Conservative discourse fillers removed from on-screen captions only (audio unchanged).
 * Intentionally excludes "like" to avoid stripping meaningful uses ("I like games").
 */
const FILLER_TOKEN = new Set([
  'uh',
  'uhh',
  'um',
  'umm',
  'eh',
  'er',
  'erm',
  'hmm',
  'hm',
  'ah',
  'ahh',
  'mmm',
  'mm',
  'uhm',
])

/** True if the token (after stripping edge punctuation) is a removable filler. */
export function isCaptionFillerToken(raw: string): boolean {
  const t = raw.replace(/^[^\w']+|[^\w']+$/g, '').toLowerCase()
  if (t.length < 2) return false
  return FILLER_TOKEN.has(t)
}

/** Removes filler tokens as whole words; normalizes spaces. */
export function stripCaptionDisplayFillers(text: string): string {
  const parts = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !isCaptionFillerToken(w))
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}
