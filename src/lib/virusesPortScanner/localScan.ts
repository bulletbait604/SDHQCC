/** Shared by the client tab and the API — no Node builtins. */

export const CLOUD_SCAN_USER_MESSAGE =
  'This scanner only reads ports on this PC (local IP). Open http://localhost:3000 after npm run dev. A Vercel or GitHub deploy is a different machine and is never scanned.'

export function hostnameFromHostHeader(hostHeader: string | null | undefined): string {
  const raw = (hostHeader || '').trim().toLowerCase()
  if (!raw) return ''
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']')
    if (end > 1) return raw.slice(1, end)
  }
  const colon = raw.indexOf(':')
  const lastColon = raw.lastIndexOf(':')
  if (colon !== -1 && colon === lastColon) return raw.slice(0, colon)
  return raw
}

export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) return false
  if (host === 'localhost' || host === '::1') return true
  const ipv4 = host.match(/^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!ipv4) return false
  return ipv4.slice(1).every((octet) => {
    const n = Number.parseInt(octet, 10)
    return n >= 0 && n <= 255
  })
}

export function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.trim().split('.')
  if (parts.length !== 4) return false
  const octets = parts.map((part) => Number.parseInt(part, 10))
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  if (octets[0] === 10) return true
  if (octets[0] === 192 && octets[1] === 168) return true
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true
  return false
}

/** True when the page/API host is this computer, not Vercel/GitHub/cloud. */
export function isThisPcScanHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) return false
  if (isLoopbackHostname(host)) return true
  if (isPrivateIpv4(host)) return true
  if (host.endsWith('.local')) return true
  if (!host.includes('.')) return true
  return false
}

export function cloudScanBlockedReason(
  hostHeader: string | null | undefined,
  hostedOnVercel = false
): string | null {
  if (hostedOnVercel) return CLOUD_SCAN_USER_MESSAGE
  const hostname = hostnameFromHostHeader(hostHeader)
  if (!isThisPcScanHost(hostname)) return CLOUD_SCAN_USER_MESSAGE
  return null
}

export function formatLocalIpDisplay(lanIps: readonly string[], fallback = '127.0.0.1'): string {
  if (lanIps.length) return lanIps.join(' · ')
  return fallback
}
