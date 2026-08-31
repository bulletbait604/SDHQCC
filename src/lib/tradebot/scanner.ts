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
import { fetchGeckoDailyBars, huntNewAndMemeCoins, type GeckoHunt } from '@/lib/tradebot/gecko'
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
    change1h: signal.change1h,
    isMeme: signal.isMeme,
    isTrending: signal.isTrending,
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

  if (!settings.cryptoOnly && settings.scanAll) {
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

  const equityPicks = new Set<string>(
    settings.cryptoOnly
      ? params.positions.filter((s) => !s.includes('.TO') && !s.includes('.V'))
      : settings.watchlist.concat(params.positions)
  )
  if (!settings.cryptoOnly && settings.scanAll) {
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
  let hunts: GeckoHunt[] = []
  if (settings.cryptoEnabled) {
    try {
      hunts = await huntNewAndMemeCoins(
        Math.max(16, settings.shortlistCrypto + 8),
        settings.watchlist.filter((s) => isCryptoSymbol(s))
      )
      scannedThisCycle += hunts.length
      if (settings.cryptoOnly) {
        universe = hunts.length
        newListings = hunts.filter((h) => h.isNew || h.isTrending).length
      }
    } catch (err) {
      console.error('[tradebot/scan] gecko hunt', err)
    }
    try {
      cryptoPairs = await listKrakenCryptoPairs()
      cryptoMarkets = await quoteKrakenMarkets(cryptoPairs)
      newCoins = (await rememberCryptoPairs(cryptoMarkets.map((m) => m.pair.symbol))).newCoins
    } catch (err) {
      console.error('[tradebot/scan] crypto', err)
    }
  }

  const newCoinSet = new Set(newCoins)
  const krakenBySymbol = new Map(cryptoMarkets.map((m) => [m.pair.symbol, m] as const))
  type CryptoJob = { symbol: string; hunt?: GeckoHunt; kraken?: CryptoMarket }
  const jobs: CryptoJob[] = []
  const seenCrypto = new Set<string>()
  const pushJob = (job: CryptoJob) => {
    if (seenCrypto.has(job.symbol)) return
    seenCrypto.add(job.symbol)
    jobs.push(job)
  }
  const huntBySymbol = new Map(hunts.map((h) => [h.symbol, h] as const))
  for (const sym of settings.watchlist) {
    if (isCryptoSymbol(sym)) {
      pushJob({ symbol: sym, hunt: huntBySymbol.get(sym), kraken: krakenBySymbol.get(sym) })
    }
  }
  for (const h of hunts) pushJob({ symbol: h.symbol, hunt: h, kraken: krakenBySymbol.get(h.symbol) })
  for (const m of cryptoMarkets) {
    if (newCoinSet.has(m.pair.symbol) || (m.dayChangePct > 8 && m.pair.symbol !== 'BTC-CAD' && m.pair.symbol !== 'ETH-CAD')) {
      pushJob({ symbol: m.pair.symbol, hunt: huntBySymbol.get(m.pair.symbol), kraken: m })
    }
  }
  for (const pos of params.positions) {
    if (isCryptoSymbol(pos)) {
      pushJob({ symbol: pos, hunt: huntBySymbol.get(pos), kraken: krakenBySymbol.get(pos) })
    }
  }
  const cryptoJobs = jobs.slice(0, settings.shortlistCrypto)

  const fx = cryptoJobs.some((j) => j.kraken && !j.kraken.pair.nativeCad) ? await usdCadRate().catch(() => 1) : 1
  const equityList = settings.cryptoOnly ? [] : Array.from(equityPicks)
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

  const cryptoRows = await mapPool(cryptoJobs, 3, async (job) => {
    const isNew = Boolean(job.hunt?.isNew || newCoinSet.has(job.symbol))
    const isMeme = Boolean(job.hunt?.isMeme)
    try {
      const fetched = job.kraken
        ? await fetchKrakenDailyBars(job.kraken.pair, fx)
        : job.hunt
          ? await fetchGeckoDailyBars(job.hunt.id, job.symbol)
          : null
      if (!fetched) return null
      const signal = analyzeCandles(job.symbol, fetched.bars, fetched.quote.price, fetched.quote.previousClose)
      if (signal) {
        signal.assetClass = 'crypto'
        signal.isNewListing = isNew || fetched.bars.length < 40
        signal.isMeme = isMeme
        signal.isTrending = Boolean(job.hunt?.isTrending)
        signal.change1h = job.hunt?.change1h
      }
      return { symbol: job.symbol, assetClass: 'crypto' as const, quote: fetched.quote, signal }
    } catch {
      const fallback = job.kraken?.quote || (job.hunt
        ? {
            symbol: job.symbol,
            price: job.hunt.priceCad,
            previousClose: job.hunt.previousClose,
            currency: 'CAD' as const,
            source: 'coingecko' as const,
            asOf: new Date().toISOString(),
          }
        : null)
      if (!fallback) return null
      const signal = analyzeCandles(job.symbol, [], fallback.price, fallback.previousClose)
      if (signal) {
        signal.assetClass = 'crypto'
        signal.isNewListing = isNew
        signal.isMeme = isMeme
        signal.isTrending = Boolean(job.hunt?.isTrending)
        signal.change1h = job.hunt?.change1h
      }
      return { symbol: job.symbol, assetClass: 'crypto' as const, quote: fallback, signal }
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
