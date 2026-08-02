/**
 * Infer viewer country / timezone from edge headers + optional Kick profile extras.
 * Used to localize posting-time recommendations in Clip Analyzer.
 */

const COUNTRY_DEFAULT_TZ: Record<string, string> = {
  US: 'America/New_York',
  CA: 'America/Toronto',
  GB: 'Europe/London',
  AU: 'Australia/Sydney',
  NZ: 'Pacific/Auckland',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  ES: 'Europe/Madrid',
  IT: 'Europe/Rome',
  NL: 'Europe/Amsterdam',
  IE: 'Europe/Dublin',
  JP: 'Asia/Tokyo',
  BR: 'America/Sao_Paulo',
  MX: 'America/Mexico_City',
  IN: 'Asia/Kolkata',
}

export type RequestGeoContext = {
  countryCode: string | null
  region: string | null
  city: string | null
  timezone: string
  areaLabel: string
}

function header(headers: Headers, name: string): string | null {
  const v = headers.get(name)?.trim()
  return v && v.length > 0 && v.toUpperCase() !== 'XX' ? v : null
}

export function resolveRequestGeo(
  headers: Headers,
  kickExtras?: { country?: string; city?: string; state?: string } | null
): RequestGeoContext {
  const countryCode = (
    header(headers, 'x-vercel-ip-country') ||
    header(headers, 'cf-ipcountry') ||
    kickExtras?.country ||
    null
  )
    ?.toUpperCase()
    .slice(0, 2) || null

  const region =
    header(headers, 'x-vercel-ip-country-region') ||
    kickExtras?.state ||
    null

  const city = header(headers, 'x-vercel-ip-city') || kickExtras?.city || null

  const tzHeader = header(headers, 'x-vercel-ip-timezone')
  const timezone =
    tzHeader ||
    (countryCode && COUNTRY_DEFAULT_TZ[countryCode]) ||
    'UTC'

  const areaBits = [city, region, countryCode].filter(Boolean)
  const areaLabel = areaBits.length ? areaBits.join(', ') : 'your region (timezone estimated)'

  return { countryCode, region, city, timezone, areaLabel }
}

export function geoPromptBlock(geo: RequestGeoContext): string {
  return `CREATOR LOCATION CONTEXT (localize posting advice):
- Area: ${geo.areaLabel}
- Timezone: ${geo.timezone}
- Country: ${geo.countryCode || 'unknown'}
Convert all "best times to post" into this creator's local timezone (${geo.timezone}). Prefer concrete local windows (e.g. "Tue–Thu 6–9pm ${geo.timezone}") over vague UTC-only advice.`
}
