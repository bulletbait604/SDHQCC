import type { DailyBar, EquityQuote } from '@/lib/tradebot/quotes'
import { parseVolatility, volatilityProfile, type VolatilityLevel } from '@/lib/tradebot/volatility'

const KRAKEN = 'https://api.kraken.com/0/public'

export type CryptoPair = {
  symbol: string
  krakenId: string
  wsname: string
  quote: 'CAD' | 'USD'
  nativeCad: boolean
  ordermin: number
  pairDecimals: number
  lotDecimals: number
}

function krakenJson(body: unknown): Record<string, unknown> {
  const rec = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const errs = Array.isArray(rec.error) ? rec.error.filter((e) => typeof e === 'string' && e) : []
  if (errs.length) throw new Error(errs.join('; '))
  return rec.result && typeof rec.result === 'object' ? (rec.result as Record<string, unknown>) : {}
}

export function isCryptoSymbol(symbol: string): boolean {
  return /^[A-Z0-9]{2,16}-CAD$/.test(symbol.trim().toUpperCase())
}

/** Real CAD cash can only buy native CAD Kraken pairs. USD-only memes need USD on Kraken. */
export function liveBuyPairOk(live: boolean, pair?: { symbol: string; nativeCad: boolean }): string | null {
  if (!live) return null
  if (!pair) return 'No Kraken pair for this coin.'
  if (!pair.nativeCad) {
    return `${pair.symbol.replace(/-CAD$/i, '')} is USD-only on Kraken. This book is CAD cash, so it was skipped.`
  }
  return null
}

export function isFxOrStableWsname(wsname: string): boolean {
  const w = wsname.toUpperCase()
  return (
    w === 'EUR/CAD' ||
    w === 'USD/CAD' ||
    w === 'USDT/CAD' ||
    w === 'USDC/CAD' ||
    w.endsWith('/USDT') ||
    w.endsWith('/USDC')
  )
}

export function displayCryptoSymbol(wsname: string): string | null {
  const m = wsname.toUpperCase().match(/^([A-Z0-9]+)\/(CAD|USD)$/)
  if (!m) return null
  const base = m[1] === 'XBT' ? 'BTC' : m[1] === 'XDG' ? 'DOGE' : m[1]
  return `${base}-CAD`
}

let pairCache: { at: number; pairs: CryptoPair[] } | null = null

export async function listKrakenCryptoPairs(): Promise<CryptoPair[]> {
  if (pairCache && Date.now() - pairCache.at < 60 * 60 * 1000) return pairCache.pairs
  const res = await fetch(`${KRAKEN}/AssetPairs`, {
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Kraken AssetPairs HTTP ${res.status}`)
  const result = krakenJson(await res.json())
  const cad: CryptoPair[] = []
  const usd: CryptoPair[] = []
  const usdExtra = new Set([
    'ADA',
    'LINK',
    'DOT',
    'AVAX',
    'LTC',
    'UNI',
    'ATOM',
    'NEAR',
    'APT',
    'SUI',
    'XLM',
    'BCH',
    'PEPE',
    'SHIB',
    'BONK',
    'WIF',
    'FLOKI',
    'PENGU',
    'TRUMP',
    'PNUT',
    'POPCAT',
    'MEW',
    'MOG',
    'TURBO',
    'HBAR',
    'RENDER',
    'TAO',
    'ONDO',
    'FET',
    'INJ',
    'TIA',
    'SEI',
    'JUP',
    'WLD',
  ])
  for (const [id, raw] of Object.entries(result)) {
    if (!raw || typeof raw !== 'object') continue
    const p = raw as Record<string, unknown>
    if (String(p.status || 'online') !== 'online') continue
    const wsname = String(p.wsname || '')
    if (isFxOrStableWsname(wsname)) continue
    const quote = String(p.quote || '')
    const display = displayCryptoSymbol(wsname)
    if (!display) continue
    const base = display.replace(/-CAD$/, '')
    const ordermin = Number(p.ordermin || 0)
    const pairDecimals = Math.min(8, Math.max(0, Number(p.pair_decimals ?? 5)))
    const lotDecimals = Math.min(8, Math.max(0, Number(p.lot_decimals ?? 8)))
    if (quote === 'ZCAD' || wsname.endsWith('/CAD')) {
      cad.push({ symbol: display, krakenId: id, wsname, quote: 'CAD', nativeCad: true, ordermin, pairDecimals, lotDecimals })
    } else if ((quote === 'ZUSD' || wsname.endsWith('/USD')) && usdExtra.has(base)) {
      usd.push({ symbol: display, krakenId: id, wsname, quote: 'USD', nativeCad: false, ordermin, pairDecimals, lotDecimals })
    }
  }
  const native = new Set(cad.map((p) => p.symbol))
  const extras = usd.filter((p) => !native.has(p.symbol))
  extras.sort((a, b) => a.symbol.localeCompare(b.symbol))
  const pairs = [...cad, ...extras]
  pairCache = { at: Date.now(), pairs }
  return pairs
}

/** Liquid names the $100 CAD desk actually trades. CAD pair when Kraken has one. */
export const KRAKEN_LIQUID_SYMBOLS = [
  'BTC-CAD',
  'ETH-CAD',
  'SOL-CAD',
  'XRP-CAD',
  'DOGE-CAD',
  'ADA-CAD',
  'LTC-CAD',
  'LINK-CAD',
  'DOT-CAD',
  'AVAX-CAD',
] as const

export async function listLiquidKrakenPairs(level: VolatilityLevel | string = 'medium'): Promise<CryptoPair[]> {
  const all = await listKrakenCryptoPairs()
  const profile = volatilityProfile(parseVolatility(level))
  const picked: CryptoPair[] = []
  for (const symbol of profile.symbols) {
    const native = all.find((p) => p.symbol === symbol && p.nativeCad)
    const any = all.find((p) => p.symbol === symbol)
    if (native) picked.push(native)
    else if (any) picked.push(any)
    if (picked.length >= profile.maxPairs) break
  }
  if (profile.fillNativeCadAlts) {
    for (const p of all) {
      if (picked.length >= profile.maxPairs) break
      if (picked.some((x) => x.symbol === p.symbol)) continue
      if (p.nativeCad || profile.level === 'high') picked.push(p)
    }
  }
  return picked
}

async function ticker(ids: string[]): Promise<Record<string, Record<string, unknown>>> {
  if (!ids.length) return {}
  const res = await fetch(`${KRAKEN}/Ticker?pair=${encodeURIComponent(ids.join(','))}`, {
    signal: AbortSignal.timeout(12_000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Kraken Ticker HTTP ${res.status}`)
  return krakenJson(await res.json()) as Record<string, Record<string, unknown>>
}

function tickerRow(
  rows: Record<string, Record<string, unknown>>,
  pairId: string
): Record<string, unknown> | undefined {
  if (rows[pairId]) return rows[pairId]
  const want = pairId.toUpperCase()
  for (const [key, val] of Object.entries(rows)) {
    if (key.toUpperCase() === want || key.toUpperCase().replace(/^X/, '') === want.replace(/^X/, '')) return val
  }
  return undefined
}
function lastPrice(row: Record<string, unknown> | undefined): number {
  const c = Array.isArray(row?.c) ? Number(row.c[0]) : NaN
  return c
}

function bookSide(row: Record<string, unknown> | undefined, key: 'a' | 'b'): number {
  const v = Array.isArray(row?.[key]) ? Number(row[key][0]) : NaN
  return Number.isFinite(v) && v > 0 ? v : NaN
}

function openPrice(row: Record<string, unknown> | undefined): number {
  return Number(row?.o)
}

function volume24h(row: Record<string, unknown> | undefined): number {
  const v = Array.isArray(row?.v) ? Number(row.v[1]) : NaN
  return Number.isFinite(v) ? v : 0
}

export async function usdCadRate(): Promise<number> {
  const rows = await ticker(['ZUSDZCAD'])
  const px = lastPrice(Object.values(rows)[0])
  if (!(px > 0)) throw new Error('No USD/CAD print from Kraken')
  return px
}

export type CryptoMarket = {
  pair: CryptoPair
  quote: EquityQuote
  volume24h: number
  dayChangePct: number
  bid: number
  ask: number
  spreadPct: number
  nativeLast: number
  nativeBid: number
  nativeAsk: number
}

export async function quoteKrakenMarkets(pairs: CryptoPair[]): Promise<CryptoMarket[]> {
  let work = pairs
  const needsFx = work.some((p) => !p.nativeCad)
  let fx = 1
  if (needsFx) {
    try {
      fx = await usdCadRate()
    } catch {
      work = work.filter((p) => p.nativeCad)
    }
  }
  const ids = Array.from(new Set(work.map((p) => p.krakenId).concat('ZUSDZCAD')))
  const rows = await ticker(ids)
  const out: CryptoMarket[] = []
  for (const pair of work) {
    const row = tickerRow(rows, pair.krakenId)
    const rawPx = lastPrice(row)
    if (!(rawPx > 0)) continue
    const fxUse = pair.nativeCad ? 1 : fx
    const price = rawPx * fxUse
    const rawBid = bookSide(row, 'b')
    const rawAsk = bookSide(row, 'a')
    const bid = (rawBid > 0 ? rawBid : rawPx) * fxUse
    const ask = (rawAsk > 0 ? rawAsk : rawPx) * fxUse
    const open = openPrice(row)
    const prev = pair.nativeCad ? (open > 0 ? open : price) : (open > 0 ? open * fx : price)
    const dayChangePct = prev > 0 ? ((price - prev) / prev) * 100 : 0
    const mid = (bid + ask) / 2
    const spreadPct = mid > 0 && ask >= bid ? ((ask - bid) / mid) * 100 : 0
    out.push({
      pair,
      quote: {
        symbol: pair.symbol,
        price,
        previousClose: prev,
        currency: 'CAD',
        source: 'kraken',
        asOf: new Date().toISOString(),
      },
      volume24h: volume24h(row),
      dayChangePct,
      bid,
      ask,
      spreadPct,
      nativeLast: rawPx,
      nativeBid: rawBid > 0 ? rawBid : rawPx,
      nativeAsk: rawAsk > 0 ? rawAsk : rawPx,
    })
  }
  return out
}

export async function fetchKrakenOhlc(
  pair: CryptoPair,
  usdCad = 1,
  interval = 1440
): Promise<{ quote: EquityQuote; bars: DailyBar[] }> {
  const res = await fetch(`${KRAKEN}/OHLC?pair=${encodeURIComponent(pair.krakenId)}&interval=${interval}`, {
    signal: AbortSignal.timeout(12_000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Kraken OHLC HTTP ${res.status}`)
  const result = krakenJson(await res.json())
  const series = (Object.values(result).find((v) => Array.isArray(v)) as unknown[]) || []
  const fx = pair.nativeCad ? 1 : usdCad
  const bars: DailyBar[] = []
  for (const row of series) {
    if (!Array.isArray(row) || row.length < 5) continue
    const t = Number(row[0]) * 1000
    const o = Number(row[1]) * fx
    const h = Number(row[2]) * fx
    const l = Number(row[3]) * fx
    const c = Number(row[4]) * fx
    const v = Number(row[6] ?? 0)
    if (![o, h, l, c].every((n) => Number.isFinite(n) && n > 0)) continue
    bars.push({ t, o, h, l, c, v: Number.isFinite(v) ? v : 0 })
  }
  const last = bars[bars.length - 1]
  if (!last) throw new Error(`No Kraken bars for ${pair.symbol}`)
  return {
    quote: {
      symbol: pair.symbol,
      price: last.c,
      previousClose: bars.length > 1 ? bars[bars.length - 2].c : last.c,
      currency: 'CAD',
      source: 'kraken',
      asOf: new Date().toISOString(),
    },
    bars,
  }
}

export function cadToVenuePrice(pair: CryptoPair, cadPrice: number, cadMark: number, nativeMark: number): number {
  if (pair.nativeCad || !(cadMark > 0) || !(nativeMark > 0)) return cadPrice
  return cadPrice * (nativeMark / cadMark)
}

export async function fetchKrakenDailyBars(pair: CryptoPair, usdCad = 1): Promise<{ quote: EquityQuote; bars: DailyBar[] }> {
  return fetchKrakenOhlc(pair, usdCad, 1440)
}

export function rankCrypto(markets: CryptoMarket[], limit: number): CryptoMarket[] {
  return [...markets]
    .sort((a, b) => Math.abs(b.dayChangePct) * Math.log10(b.volume24h + 10) - Math.abs(a.dayChangePct) * Math.log10(a.volume24h + 10))
    .slice(0, limit)
}

export async function probeCryptoQuotes(): Promise<{
  ok: boolean
  source?: 'kraken'
  symbol: string
  price?: number
  error?: string
}> {
  const symbol = 'BTC-CAD'
  try {
    const pairs = (await listKrakenCryptoPairs()).filter((p) => p.symbol === symbol)
    if (!pairs.length) throw new Error('BTC-CAD not listed on Kraken CAD')
    const [m] = await quoteKrakenMarkets(pairs)
    if (!m) throw new Error('No BTC-CAD ticker')
    return { ok: true, source: 'kraken', symbol, price: m.quote.price }
  } catch (err) {
    return { ok: false, symbol, error: err instanceof Error ? err.message : 'crypto probe failed' }
  }
}
