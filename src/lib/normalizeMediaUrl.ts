/**
 * Normalize a media URL for validators and fetch().
 * Handles protocol-relative URLs and stray whitespace from providers.
 */
export function normalizeHttpMediaUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  return null
}
