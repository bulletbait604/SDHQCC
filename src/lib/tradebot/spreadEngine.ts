import type { TradebotOpportunity, TradebotSeverity } from '@/lib/tradebot/types'
import { tradebotFeeBps } from '@/lib/tradebot/env'
import type { KrakenCadQuote } from '@/lib/tradebot/krakenClient'
import type { CoinGeckoCadQuote } from '@/lib/tradebot/coingeckoClient'
import type { FinnhubStockQuote } from '@/lib/tradebot/finnhubClient'
import type { BitbuyCadQuote } from '@/lib/tradebot/bitbuyClient'
import { CRYPTO_MIN_NET_EDGE_BPS, STOCK_UNUSUAL_MOVE_PCT } from '@/lib/tradebot/watchlist'

function spreadBps(priceA: number, priceB: number): number {
  const mid = (priceA + priceB) / 2
  if (mid <= 0) return 0
  return ((priceA - priceB) / mid) * 10_000
}

function severityFromNetBps(netBps: number): TradebotSeverity {
  const abs = Math.abs(netBps)
  if (abs >= 80) return 'high'
  if (abs >= 50) return 'medium'
  if (abs >= CRYPTO_MIN_NET_EDGE_BPS) return 'low'
  return 'info'
}

function stockSeverityFromChangePct(pct: number): TradebotSeverity {
  const abs = Math.abs(pct)
  if (abs >= 8) return 'high'
  if (abs >= 5) return 'medium'
  if (abs >= STOCK_UNUSUAL_MOVE_PCT) return 'low'
  return 'info'
}

export function detectCryptoCrossVenueOpportunities(
  kraken: KrakenCadQuote[],
  coingecko: CoinGeckoCadQuote[]
): TradebotOpportunity[] {
  const fees = tradebotFeeBps()
  const roundTripBps = fees.kraken + fees.coingecko
  const geckoBySymbol = new Map(coingecko.map((q) => [q.symbol, q]))
  const out: TradebotOpportunity[] = []

  for (const k of kraken) {
    const g = geckoBySymbol.get(k.symbol)
    if (!g) continue
    const raw = spreadBps(k.last, g.priceCad)
    const netEdgeBps = Math.abs(raw) - roundTripBps
    if (netEdgeBps < CRYPTO_MIN_NET_EDGE_BPS) continue

    const krakenHigher = k.last > g.priceCad
    out.push({
      id: `crypto-xv-${k.symbol}`,
      kind: 'crypto_cross_venue',
      symbol: k.symbol,
      label: k.label,
      venueA: krakenHigher ? 'Kraken' : 'CoinGecko (index)',
      venueB: krakenHigher ? 'CoinGecko (index)' : 'Kraken',
      priceA: krakenHigher ? k.last : g.priceCad,
      priceB: krakenHigher ? g.priceCad : k.last,
      currency: 'CAD',
      spreadBps: raw,
      netEdgeBps,
      severity: severityFromNetBps(netEdgeBps),
      note: `Kraken ${k.last.toFixed(2)} CAD vs CoinGecko ${g.priceCad.toFixed(2)} CAD after ~${roundTripBps} bps fees.`,
    })
  }
  return out
}

export function detectBitbuyOpportunities(
  kraken: KrakenCadQuote[],
  bitbuy: BitbuyCadQuote[]
): TradebotOpportunity[] {
  if (bitbuy.length === 0) return []
  const fees = tradebotFeeBps()
  const roundTripBps = fees.kraken + fees.bitbuy
  const bitbuyBySymbol = new Map(bitbuy.map((q) => [q.symbol, q]))
  const out: TradebotOpportunity[] = []

  for (const k of kraken) {
    const b = bitbuyBySymbol.get(k.symbol)
    if (!b) continue
    const raw = spreadBps(b.ask, k.bid)
    const netEdgeBps = raw - roundTripBps
    if (netEdgeBps < CRYPTO_MIN_NET_EDGE_BPS) continue
    out.push({
      id: `crypto-bb-${k.symbol}`,
      kind: 'crypto_bitbuy',
      symbol: k.symbol,
      label: k.label,
      venueA: 'Bitbuy (ask)',
      venueB: 'Kraken (bid)',
      priceA: b.ask,
      priceB: k.bid,
      currency: 'CAD',
      spreadBps: raw,
      netEdgeBps,
      severity: severityFromNetBps(netEdgeBps),
      note: `Buy on Kraken, sell on Bitbuy (or reverse) — net ~${netEdgeBps.toFixed(0)} bps after fees.`,
    })
  }
  return out
}

export function detectStockUnusualMoves(stocks: FinnhubStockQuote[]): TradebotOpportunity[] {
  const out: TradebotOpportunity[] = []
  for (const s of stocks) {
    if (Math.abs(s.changePct) < STOCK_UNUSUAL_MOVE_PCT) continue
    out.push({
      id: `stock-move-${s.symbol}`,
      kind: 'stock_unusual_move',
      symbol: s.symbol,
      label: s.label,
      venueA: 'Finnhub',
      venueB: 'Prior close',
      priceA: s.priceUsd,
      priceB: s.prevClose,
      currency: 'USD',
      spreadBps: s.changePct * 100,
      netEdgeBps: s.changePct * 100,
      severity: stockSeverityFromChangePct(s.changePct),
      note: `${s.symbol} ${s.changePct >= 0 ? 'up' : 'down'} ${Math.abs(s.changePct).toFixed(2)}% today — review on TD Active Trader (not auto-trade).`,
    })
  }
  return out
}

export function sortOpportunities(opps: TradebotOpportunity[]): TradebotOpportunity[] {
  const rank: Record<TradebotSeverity, number> = { high: 0, medium: 1, low: 2, info: 3 }
  return [...opps].sort((a, b) => {
    const sr = rank[a.severity] - rank[b.severity]
    if (sr !== 0) return sr
    return Math.abs(b.netEdgeBps) - Math.abs(a.netEdgeBps)
  })
}
