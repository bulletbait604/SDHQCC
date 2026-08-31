import { analyzeCandles, type SignalAnalysis } from '@/lib/tradebot/indicators'
import {
  fetchKrakenDailyBars,
  isCryptoSymbol,
  listKrakenCryptoPairs,
  quoteKrakenMarkets,
  usdCadRate,
  type CryptoMarket,
  type CryptoPair,
} from '@/lib/tradebot/crypto'
import { fetchIndustryTape, fetchNewsForNames, type NameNews, type NewsHeadline } from '@/lib/tradebot/news'
import { isHighPotential, opportunityScore, pickTopSymbols } from '@/lib/tradebot/opportunity'
import { fetchDailyBars, fetchSparkQuotes } from '@/lib/tradebot/quotes'
import { getTradebotSettings } from '@/lib/tradebot/settings'
import {
  listNewListingSymbols,
  rankedEquityCache,
  refreshListedUniverse,
  rememberCryptoPairs,
  saveScanQuotes,
  takeScanSlice,
} from '@/lib/tradebot/universe'

export type ScanSummary = {
  universe: number
  scannedThisCycle: number
  newListings: number
  cryptoPairs: number
  shortlist: string[]
  highPotential: string[]
  newsItems: number
  industryTape: string[]
  refreshed: boolean
}

export type MarketRow = {
  symbol: string
  assetClass: 'equity' | 'crypto'
  quote: Awaited<ReturnType<typeof fetchDailyBars>>['quote']
  signal: SignalAnalysis | null
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const worker = async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, () => worker()))
  return out
}

function attachNews(signal: SignalAnalysis | null, news: NameNews | undefined, isNew: boolean): SignalAnalysis | null {
  if (!signal) return null
  const headlines = (news?.headlines || []).map((h) => h.title)
  const newsTone = news?.tone || 'quiet'
  const highPotential = isHighPotential({
    dayChangePct: signal.previousClose
      ? ((signal.price - signal.previousClose) / signal.previousClose) * 100
      : 0,
    barsCount: 0,
    isNewListing: isNew,
    assetClass: signal.assetClass || 'equity',
    symbol: signal.ticker,
    newsTone,
  })
  return {
    ...signal,
    isNewListing: isNew,
    newsTone,
    headlines,
    highPotential: highPotential || isNew,
  }
}

export async function scanCadBook(params: {
  positions: string[]
}): Promise<{ market: MarketRow[]; scan: ScanSummary }> {
  const settings = getTradebotSettings()
  let universe = 0
  let newListings = 0
  let refreshed = false
  let scannedThisCycle = 0
  let freshListings: string[] = []

  if (settings.scanAll) {
    try {
      const u = await refreshListedUniverse()
      universe = u.universe
      newListings = u.newListings
      refreshed = u.refreshed
      freshListings = await listNewListingSymbols(40)
      const slice = await takeScanSlice(settings.scanBatch)
      universe = slice.total || universe
      const batch = Array.from(new Set(settings.watchlist.concat(params.positions, freshListings, slice.symbols)))
      const spark = await fetchSparkQuotes(batch)
      scannedThisCycle = spark.length
      const freshSet = new Set(freshListings)
      await saveScanQuotes(
        spark.map((q) => {
          const dayChangePct = q.previousClose > 0 ? ((q.price - q.previousClose) / q.previousClose) * 100 : 0
          const isNew = freshSet.has(q.symbol)
          return {
            symbol: q.symbol,
            lastPrice: q.price,
            previousClose: q.previousClose,
            dayChangePct,
            barsCount: q.barsCount,
            score: opportunityScore({
              dayChangePct,
              barsCount: q.barsCount,
              isNewListing: isNew,
              assetClass: 'equity',
              symbol: q.symbol,
            }),
          }
        })
      )
    } catch (err) {
      console.error('[tradebot/scan] equity universe', err)
    }
  }

  const equityPicks = new Set<string>(settings.watchlist.concat(params.positions))
  if (settings.scanAll) {
    try {
      const ranked = await rankedEquityCache(24)
      const freshSet = new Set(freshListings.length ? freshListings : await listNewListingSymbols(24))
      const newcomers = ranked.filter((r) => freshSet.has(r.symbol) || (r.barsCount || 0) < 40)
      const rest = ranked.filter((r) => !newcomers.includes(r))
      for (const row of pickTopSymbols(newcomers, (r) => Number(r.score || 0), 5)) equityPicks.add(row.symbol)
      for (const row of pickTopSymbols(rest, (r) => Number(r.score || 0), Math.max(3, settings.shortlistStocks - 5))) {
        equityPicks.add(row.symbol)
      }
      for (const sym of Array.from(freshSet).slice(0, 5)) equityPicks.add(sym)
    } catch (err) {
      console.error('[tradebot/scan] rank', err)
    }
  }

  let cryptoPairs: CryptoPair[] = []
  let cryptoMarkets: CryptoMarket[] = []
  let newCoins: string[] = []
  if (settings.cryptoEnabled) {
    try {
      cryptoPairs = await listKrakenCryptoPairs()
      cryptoMarkets = await quoteKrakenMarkets(cryptoPairs)
      newCoins = (await rememberCryptoPairs(cryptoMarkets.map((m) => m.pair.symbol))).newCoins
    } catch (err) {
      console.error('[tradebot/scan] crypto', err)
    }
  }

  const newCoinSet = new Set(newCoins)
  const scoredCrypto = cryptoMarkets.map((m) => ({
    market: m,
    score: opportunityScore({
      dayChangePct: m.dayChangePct,
      barsCount: 30,
      isNewListing: newCoinSet.has(m.pair.symbol),
      assetClass: 'crypto',
      symbol: m.pair.symbol,
    }),
  }))
  const freshCrypto = scoredCrypto.filter((r) => newCoinSet.has(r.market.pair.symbol) || !['BTC-CAD', 'ETH-CAD'].includes(r.market.pair.symbol))
  const cryptoShort = pickTopSymbols(freshCrypto, (r) => r.score, Math.max(3, settings.shortlistCrypto - 2))
    .concat(pickTopSymbols(scoredCrypto, (r) => r.score, 2))
    .map((r) => r.market)
  const cryptoSeen = new Set<string>()
  const cryptoDeduped: CryptoMarket[] = []
  for (const m of cryptoShort) {
    if (cryptoSeen.has(m.pair.symbol)) continue
    cryptoSeen.add(m.pair.symbol)
    cryptoDeduped.push(m)
    if (cryptoDeduped.length >= settings.shortlistCrypto) break
  }
  for (const pos of params.positions) {
    if (isCryptoSymbol(pos)) {
      const hit = cryptoMarkets.find((m) => m.pair.symbol === pos)
      if (hit && !cryptoDeduped.includes(hit)) cryptoDeduped.push(hit)
    }
  }

  const fx = cryptoDeduped.some((m) => !m.pair.nativeCad) ? await usdCadRate().catch(() => 1) : 1
  const equityList = Array.from(equityPicks)
  const freshSet = new Set(freshListings)
  const equityRows = await mapPool(equityList, 4, async (symbol) => {
    try {
      const { quote, bars } = await fetchDailyBars(symbol)
      const signal = analyzeCandles(symbol, bars, quote.price, quote.previousClose)
      if (signal) {
        signal.assetClass = 'equity'
        signal.isNewListing = freshSet.has(symbol) || bars.length < 40
      }
      return { symbol, assetClass: 'equity' as const, quote, signal }
    } catch {
      return null
    }
  })

  const cryptoRows = await mapPool(cryptoDeduped, 3, async (m) => {
    const isNew = newCoinSet.has(m.pair.symbol)
    try {
      const { quote, bars } = await fetchKrakenDailyBars(m.pair, fx)
      const signal = analyzeCandles(m.pair.symbol, bars, quote.price, quote.previousClose)
      if (signal) {
        signal.assetClass = 'crypto'
        signal.isNewListing = isNew || bars.length < 40
      }
      return { symbol: m.pair.symbol, assetClass: 'crypto' as const, quote, signal }
    } catch {
      const signal = analyzeCandles(m.pair.symbol, [], m.quote.price, m.quote.previousClose)
      if (signal) {
        signal.assetClass = 'crypto'
        signal.isNewListing = isNew
      }
      return { symbol: m.pair.symbol, assetClass: 'crypto' as const, quote: m.quote, signal }
    }
  })

  let market = [...equityRows, ...cryptoRows].filter((row): row is MarketRow => Boolean(row))

  let nameNews: NameNews[] = []
  let industryTape: NewsHeadline[] = []
  try {
    industryTape = await fetchIndustryTape()
    nameNews = await fetchNewsForNames(market.map((m) => ({ symbol: m.symbol })))
  } catch (err) {
    console.error('[tradebot/scan] news', err)
  }
  const newsBySymbol = new Map(nameNews.map((n) => [n.symbol, n]))
  market = market.map((row) => ({
    ...row,
    signal: attachNews(row.signal, newsBySymbol.get(row.symbol), Boolean(row.signal?.isNewListing)),
  }))

  const highPotential = market
    .filter((m) => m.signal?.highPotential)
    .map((m) => m.symbol)

  return {
    market,
    scan: {
      universe: universe || equityList.length,
      scannedThisCycle,
      newListings,
      cryptoPairs: cryptoMarkets.length,
      shortlist: market.map((m) => m.symbol),
      highPotential,
      newsItems: nameNews.reduce((n, row) => n + row.headlines.length, 0) + industryTape.length,
      industryTape: industryTape.map((h) => h.title),
      refreshed,
    },
  }
}
