export type QuoteSource = 'yahoo' | 'stooq'

export type EquityQuote = {
  symbol: string
  price: number
  previousClose: number
  currency: string
  source: QuoteSource
  asOf: string
}

export type DailyBar = {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

/** Yahoo uses dashes for class shares: BTCC.B.TO → BTCC-B.TO */
export function toYahooSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase()
  const m = upper.match(/^(.+)\.(TO|V)$/)
  if (!m) return upper
  return `${m[1].replace(/\./g, '-')}.${m[2]}`
}

/** Stooq uses lowercase: VFV.TO → vfv.to, BTCC.B.TO → btcc-b.to */
export function toStooqSymbol(symbol: string): string {
  return toYahooSymbol(symbol).toLowerCase()
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': YAHOO_UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function quoteYahoo(symbol: string): Promise<EquityQuote> {
  const y = toYahooSymbol(symbol)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?interval=1d&range=5d`
  const body = (await fetchJson(url, 8000)) as {
    chart?: { result?: Array<{ meta?: Record<string, unknown> }> }
  }
  const meta = body.chart?.result?.[0]?.meta
  const price = Number(meta?.regularMarketPrice)
  if (!Number.isFinite(price) || price <= 0) throw new Error('Yahoo returned no price')
  const previousClose = Number(meta?.chartPreviousClose ?? meta?.previousClose ?? price)
  const currency = String(meta?.currency || 'CAD')
  return {
    symbol: symbol.trim().toUpperCase(),
    price,
    previousClose: Number.isFinite(previousClose) && previousClose > 0 ? previousClose : price,
    currency,
    source: 'yahoo',
    asOf: new Date().toISOString(),
  }
}

async function quoteStooq(symbol: string): Promise<EquityQuote> {
  const s = toStooqSymbol(symbol)
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(s)}&f=sd2t2ohlcv&h&e=csv`
  const res = await fetch(url, {
    headers: { 'User-Agent': YAHOO_UA, Accept: 'text/csv' },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Stooq HTTP ${res.status}`)
  const text = await res.text()
  const line = text.trim().split('\n').pop() || ''
  const cols = line.split(',')
  const close = Number(cols[6])
  if (!Number.isFinite(close) || close <= 0) throw new Error('Stooq returned no price')
  return {
    symbol: symbol.trim().toUpperCase(),
    price: close,
    previousClose: close,
    currency: 'CAD',
    source: 'stooq',
    asOf: new Date().toISOString(),
  }
}

export async function fetchDailyBars(symbol: string): Promise<{
  quote: EquityQuote
  bars: DailyBar[]
}> {
  const y = toYahooSymbol(symbol)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?interval=1d&range=6mo`
  try {
    const body = (await fetchJson(url, 10000)) as {
      chart?: {
        result?: Array<{
          meta?: Record<string, unknown>
          timestamp?: number[]
          indicators?: { quote?: Array<Record<string, Array<number | null>>> }
        }>
      }
    }
    const result = body.chart?.result?.[0]
    const meta = result?.meta
    const price = Number(meta?.regularMarketPrice)
    if (!Number.isFinite(price) || price <= 0) throw new Error('Yahoo returned no price')
    const previousClose = Number(meta?.chartPreviousClose ?? meta?.previousClose ?? price)
    const ts = Array.isArray(result?.timestamp) ? result.timestamp : []
    const q = result?.indicators?.quote?.[0]
    const bars: DailyBar[] = []
    for (let i = 0; i < ts.length; i++) {
      const o = Number(q?.open?.[i])
      const h = Number(q?.high?.[i])
      const l = Number(q?.low?.[i])
      const c = Number(q?.close?.[i])
      const v = Number(q?.volume?.[i] ?? 0)
      if (![o, h, l, c].every((n) => Number.isFinite(n) && n > 0)) continue
      bars.push({ t: ts[i] * 1000, o, h, l, c, v: Number.isFinite(v) ? v : 0 })
    }
    if (bars.length < 20) throw new Error('Not enough Yahoo bars')
    return {
      quote: {
        symbol: symbol.trim().toUpperCase(),
        price,
        previousClose: Number.isFinite(previousClose) && previousClose > 0 ? previousClose : price,
        currency: String(meta?.currency || 'CAD'),
        source: 'yahoo',
        asOf: new Date().toISOString(),
      },
      bars,
    }
  } catch {
    const quote = await fetchEquityQuote(symbol)
    return { quote, bars: [] }
  }
}

export async function fetchEquityQuote(symbol: string): Promise<EquityQuote> {
  try {
    return await quoteYahoo(symbol)
  } catch (yahooErr) {
    try {
      return await quoteStooq(symbol)
    } catch {
      const msg = yahooErr instanceof Error ? yahooErr.message : 'quote failed'
      throw new Error(`No quote for ${symbol}: ${msg}`)
    }
  }
}

export async function probeTsxQuotes(): Promise<{
  ok: boolean
  source?: QuoteSource
  symbol: string
  price?: number
  error?: string
}> {
  const symbol = 'VFV.TO'
  try {
    const q = await fetchEquityQuote(symbol)
    return { ok: true, source: q.source, symbol, price: q.price }
  } catch (err) {
    return { ok: false, symbol, error: err instanceof Error ? err.message : 'quote probe failed' }
  }
}
