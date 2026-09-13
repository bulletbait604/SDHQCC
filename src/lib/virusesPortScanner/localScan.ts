/** Shared by the client tab and the API — no Node builtins. */

export const LOCAL_AGENT_PORT = 3847
export const LOCAL_AGENT_UI_URL = `http://127.0.0.1:${LOCAL_AGENT_PORT}/`
export const LOCAL_AGENT_SCAN_URL = `http://127.0.0.1:${LOCAL_AGENT_PORT}/scan`
export const LOCAL_AGENT_HEALTH_URL = `http://127.0.0.1:${LOCAL_AGENT_PORT}/health`
export const LOCAL_AGENT_NOTE =
  'Served from the local scanner on this PC. Keep npm run viruses-server running.'

export const CLOUD_SCAN_USER_MESSAGE =
  'Open the local scanner at http://127.0.0.1:3847/ (npm run viruses-server). The live Vercel/GitHub host is a different machine and is never scanned.'

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

export function isAllowedAgentPageOrigin(origin: string): boolean {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }
  const host = url.hostname.toLowerCase()
  if (url.protocol === 'http:' && isThisPcScanHost(host)) return true
  if (url.protocol !== 'https:') return false
  if (host === 'sdcreatorcorner.com' || host === 'www.sdcreatorcorner.com') return true
  if (host === 'sdhqcc.vercel.app') return true
  if (/^sdhqcc([.-].*)?\.vercel\.app$/.test(host)) return true
  return false
}

/** Reflect Origin when the page is allowed; null if curl/no Origin; false if blocked. */
export function agentAllowedCorsOrigin(originHeader: string | null | undefined): string | null | false {
  const origin = (originHeader || '').trim()
  if (!origin) return null
  return isAllowedAgentPageOrigin(origin) ? origin : false
}
