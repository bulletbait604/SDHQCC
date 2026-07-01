export type TradebotOpportunityKind =
  | 'crypto_cross_venue'
  | 'crypto_bitbuy'
  | 'stock_unusual_move'

export type TradebotSeverity = 'high' | 'medium' | 'low' | 'info'

export interface TradebotOpportunity {
  id: string
  kind: TradebotOpportunityKind
  symbol: string
  label: string
  venueA: string
  venueB: string
  priceA: number
  priceB: number
  currency: 'CAD' | 'USD'
  /** Raw spread in basis points (1 bp = 0.01%). */
  spreadBps: number
  /** Spread after estimated round-trip fees. */
  netEdgeBps: number
  severity: TradebotSeverity
  note: string
}

export interface TradebotProviderStatus {
  kraken: 'ok' | 'error' | 'skipped'
  coingecko: 'ok' | 'error' | 'skipped'
  finnhub: 'ok' | 'error' | 'skipped'
  bitbuy: 'ok' | 'error' | 'skipped'
  frankfurter: 'ok' | 'error' | 'skipped'
}

export interface TradebotSnapshot {
  scannedAt: string
  opportunities: TradebotOpportunity[]
  aiSummary: string | null
  providers: TradebotProviderStatus
  errors: string[]
  finnhubConfigured: boolean
  bitbuyConfigured: boolean
}

export interface TradebotQuote {
  symbol: string
  label: string
  price: number
  currency: 'CAD' | 'USD'
  changePct?: number
  venue: string
}
