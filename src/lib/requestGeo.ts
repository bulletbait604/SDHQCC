/**
 * Infer viewer timezone from edge headers (for localizing posting windows).
 * Do not expose city/region/country in product UI or AI-facing posting copy.
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
  timezone: string
}

function header(headers: Headers, name: string): string | null {
  const v = headers.get(name)?.trim()
  return v && v.length > 0 && v.toUpperCase() !== 'XX' ? v : null
}

export function resolveRequestGeo(
  headers: Headers,
  _kickExtras?: { country?: string; city?: string; state?: string } | null
): RequestGeoContext {
  const countryCode = (
    header(headers, 'x-vercel-ip-country') ||
    header(headers, 'cf-ipcountry') ||
    null
  )
    ?.toUpperCase()
    .slice(0, 2) || null

  const tzHeader = header(headers, 'x-vercel-ip-timezone')
  const timezone =
    tzHeader ||
    (countryCode && COUNTRY_DEFAULT_TZ[countryCode]) ||
    'UTC'

  return { timezone }
}

export function geoPromptBlock(geo: RequestGeoContext): string {
  return `CREATOR TIMEZONE (localize posting advice — do NOT mention city, region, or country):
- Timezone: ${geo.timezone}
Convert all "best times to post" into this timezone (${geo.timezone}). Prefer concrete local windows (e.g. "Tue–Thu 6–9pm ${geo.timezone}") over vague UTC-only advice. Never name the creator's city, state, or country in postingPlan or recommendations.`
}
