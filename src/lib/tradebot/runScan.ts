import { fetchKrakenCadQuotes } from '@/lib/tradebot/krakenClient'
import { fetchCoinGeckoCadQuotes } from '@/lib/tradebot/coingeckoClient'
import { fetchFinnhubStockQuotes, isFinnhubConfigured } from '@/lib/tradebot/finnhubClient'
import { fetchBitbuyCadQuotes } from '@/lib/tradebot/bitbuyClient'
import { bitbuyApiConfigured } from '@/lib/tradebot/env'
import {
  detectBitbuyOpportunities,
  detectCryptoCrossVenueOpportunities,
  detectStockUnusualMoves,
  sortOpportunities,
} from '@/lib/tradebot/spreadEngine'
import { summarizeTradebotOpportunities } from '@/lib/tradebot/geminiAnalysis'
import { writeTradebotSnapshot } from '@/lib/tradebot/store'
import type { TradebotProviderStatus, TradebotSnapshot } from '@/lib/tradebot/types'
import { getCadFxRates } from '@/lib/currency'

async function providerResult<T>(
  fn: () => Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function runTradebotScan(): Promise<TradebotSnapshot> {
  const errors: string[] = []
  const providers: TradebotProviderStatus = {
    kraken: 'skipped',
    coingecko: 'skipped',
    finnhub: 'skipped',
    bitbuy: 'skipped',
    frankfurter: 'skipped',
  }

  const fxResult = await providerResult(() => getCadFxRates())
  if (fxResult.ok) {
    providers.frankfurter = 'ok'
  } else {
    providers.frankfurter = 'error'
    errors.push(`Frankfurter FX: ${fxResult.error}`)
  }

  const krakenResult = await providerResult(() => fetchKrakenCadQuotes())
  const kraken = krakenResult.ok ? krakenResult.data : []
  providers.kraken = krakenResult.ok ? 'ok' : 'error'
  if (!krakenResult.ok) errors.push(`Kraken: ${krakenResult.error}`)

  const geckoResult = await providerResult(() => fetchCoinGeckoCadQuotes())
  const coingecko = geckoResult.ok ? geckoResult.data : []
  providers.coingecko = geckoResult.ok ? 'ok' : 'error'
  if (!geckoResult.ok) errors.push(`CoinGecko: ${geckoResult.error}`)

  let finnhubQuotes: Awaited<ReturnType<typeof fetchFinnhubStockQuotes>> = []
  if (isFinnhubConfigured()) {
    const finnhubResult = await providerResult(() => fetchFinnhubStockQuotes())
    finnhubQuotes = finnhubResult.ok ? finnhubResult.data : []
    providers.finnhub = finnhubResult.ok ? 'ok' : 'error'
    if (!finnhubResult.ok) errors.push(`Finnhub: ${finnhubResult.error}`)
  } else {
    providers.finnhub = 'skipped'
    errors.push('Finnhub: FINNHUB_API_KEY not set — stock watchlist disabled.')
  }

  let bitbuyQuotes: Awaited<ReturnType<typeof fetchBitbuyCadQuotes>> = []
  if (bitbuyApiConfigured()) {
    const bitbuyResult = await providerResult(() => fetchBitbuyCadQuotes())
    bitbuyQuotes = bitbuyResult.ok ? bitbuyResult.data : []
    providers.bitbuy = bitbuyResult.ok && bitbuyQuotes.length > 0 ? 'ok' : 'skipped'
    if (!bitbuyResult.ok) errors.push(`Bitbuy: ${bitbuyResult.error}`)
  } else {
    providers.bitbuy = 'skipped'
  }

  const opportunities = sortOpportunities([
    ...detectCryptoCrossVenueOpportunities(kraken, coingecko),
    ...detectBitbuyOpportunities(kraken, bitbuyQuotes),
    ...detectStockUnusualMoves(finnhubQuotes),
  ])

  const aiSummary = await summarizeTradebotOpportunities(opportunities)

  const snapshot: TradebotSnapshot = {
    scannedAt: new Date().toISOString(),
    opportunities,
    aiSummary,
    providers,
    errors,
    finnhubConfigured: isFinnhubConfigured(),
    bitbuyConfigured: bitbuyApiConfigured(),
  }

  await writeTradebotSnapshot(snapshot)
  return snapshot
}
