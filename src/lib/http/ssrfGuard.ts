import { normalizeHttpMediaUrl } from '@/lib/normalizeMediaUrl'

/** Block obvious private / link-local targets for server-side fetch. */
export function isPublicHttpUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  if (parsed.username || parsed.password) return false

  const host = parsed.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return false
  }

  if (host === '::1' || host === '[::1]') return false

  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map((n) => Number.parseInt(n, 10))
    if (octets.some((n) => n > 255)) return false
    const [a, b] = octets
    if (a === 10) return false
    if (a === 127) return false
    if (a === 0) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
  }

  return true
}

export function assertSafeExternalMediaUrl(raw: unknown): string {
  const normalized = normalizeHttpMediaUrl(raw)
  if (!normalized) {
    throw new Error('A valid https:// video URL is required.')
  }
  if (!isPublicHttpUrl(normalized)) {
    throw new Error('URL must be a public HTTPS address.')
  }
  return normalized
}
