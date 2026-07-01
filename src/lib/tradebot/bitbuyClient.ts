import { bitbuyApiConfigured } from '@/lib/tradebot/env'

export type BitbuyCadQuote = {
  symbol: string
  label: string
  bid: number
  ask: number
  last: number
}

/** Bitbuy requires partner API access — optional until keys are configured. */
export async function fetchBitbuyCadQuotes(): Promise<BitbuyCadQuote[]> {
  if (!bitbuyApiConfigured()) return []
  // Partner API integration lands when BITBUY_API_KEY + BITBUY_API_SECRET are approved.
  return []
}

export function bitbuySetupHint(): string {
  return 'Request Bitbuy Partner API access, then set BITBUY_API_KEY and BITBUY_API_SECRET in Vercel.'
}
