const FX_CACHE_TTL_MS = 30 * 60 * 1000

type FxCache = {
  expiresAt: number
  rates: Record<string, number>
}

let fxCache: FxCache | null = null

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  AU: 'AUD',
  NZ: 'NZD',
  EU: 'EUR',
  DE: 'EUR',
  FR: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  NL: 'EUR',
  IE: 'EUR',
  PT: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  FI: 'EUR',
  JP: 'JPY',
}

export const SUPPORTED_PAYPAL_CURRENCIES = new Set<string>([
  'CAD',
  'USD',
  'EUR',
  'GBP',
  'AUD',
  'NZD',
  'JPY',
])

function roundMoney(value: number, currency: string): number {
  if (currency === 'JPY') return Math.max(1, Math.round(value))
  return Math.max(0.5, Math.round(value * 100) / 100)
}

function defaultRates(): Record<string, number> {
  return {
    CAD: 1,
    USD: 0.73,
    EUR: 0.68,
    GBP: 0.58,
    AUD: 1.11,
    NZD: 1.2,
    JPY: 110,
  }
}

export async function getCadFxRates(): Promise<Record<string, number>> {
  const now = Date.now()
  if (fxCache && fxCache.expiresAt > now) return fxCache.rates

  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=CAD', {
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`FX HTTP ${response.status}`)
    const data = (await response.json()) as { rates?: Record<string, number> }
    const merged = { ...defaultRates(), CAD: 1, ...(data.rates ?? {}) }
    fxCache = { rates: merged, expiresAt: now + FX_CACHE_TTL_MS }
    return merged
  } catch (error) {
    console.warn('[currency] FX fallback used:', error)
    const fallback = defaultRates()
    fxCache = { rates: fallback, expiresAt: now + 5 * 60 * 1000 }
    return fallback
  }
}

export function detectCurrencyFromHeaders(headers: Headers): string {
  const explicit = headers.get('x-sdhq-currency')?.toUpperCase().trim()
  if (explicit && SUPPORTED_PAYPAL_CURRENCIES.has(explicit)) return explicit

  const countryRaw =
    headers.get('x-vercel-ip-country') ??
    headers.get('cf-ipcountry') ??
    headers.get('x-country-code') ??
    ''
  const country = countryRaw.toUpperCase().trim()
  const mapped = COUNTRY_TO_CURRENCY[country]
  if (mapped && SUPPORTED_PAYPAL_CURRENCIES.has(mapped)) return mapped
  return 'USD'
}

export async function convertCadAmount(amountCad: number, currency: string): Promise<number> {
  const rates = await getCadFxRates()
  const rate = rates[currency] ?? rates.USD ?? 0.73
  return roundMoney(amountCad * rate, currency)
}
