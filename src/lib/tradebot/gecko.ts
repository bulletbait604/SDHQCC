import type { DailyBar, EquityQuote } from '@/lib/tradebot/quotes'
import { isMemeTicker, shortTermScore } from '@/lib/tradebot/opportunity'

function geckoProEnabled(): boolean {
  const v = process.env.COINGECKO_USE_PRO?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

/** Free Demo key. COINGECKO_PRO_API_KEY is accepted as a demo key unless COINGECKO_USE_PRO=true. */
function geckoKey(): string {
  return (
    process.env.COINGECKO_DEMO_API_KEY ||
    process.env.COINGECKO_API_KEY ||
    process.env.COINGECKO_PRO_API_KEY ||
    ''
  ).trim()
}

function geckoHost(): string {
  return geckoProEnabled() ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3'
}

export type GeckoHunt = {
  id: string
  symbol: string
  name: string
  priceCad: number
  previousClose: number
  change1h: number
  change24h: number
  volumeCad: number
  isMeme: boolean
  isTrending: boolean
  isNew: boolean
  score: number
}

function geckoHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const key = geckoKey()
  if (!key) return headers
  if (geckoProEnabled()) headers['x-cg-pro-api-key'] = key
  else headers['x-cg-demo-api-key'] = key
  return headers
}

async function geckoJson(path: string): Promise<unknown> {
  const res = await fetch(`${geckoHost()}${path}`, {
    headers: geckoHeaders(),
    signal: AbortSignal.timeout(12_000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
  return res.json()
}

function pause(ms = 280): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function paperSymbol(raw: string): string {
  return `${raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)}-CAD`
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function isFreshDate(iso: unknown, days = 60): boolean {
  if (typeof iso !== 'string' || !iso) return false
  const t = Date.parse(iso)
  return Number.isFinite(t) && Date.now() - t < days * 24 * 60 * 60 * 1000
}

type MarketRow = {
  id: string
  symbol: string
  name: string
  current_price?: number
  total_volume?: number
  market_cap?: number
  market_cap_rank?: number | null
  atl_date?: string
  price_change_percentage_1h_in_currency?: number
  price_change_percentage_24h?: number
}

function scored(hunt: Omit<GeckoHunt, 'score'>): GeckoHunt {
  return {
    ...hunt,
    score: shortTermScore({
      change1h: hunt.change1h,
      change24h: hunt.change24h,
      volumeCad: hunt.volumeCad,
      isMeme: hunt.isMeme,
      isTrending: hunt.isTrending,
      isNew: hunt.isNew,
      symbol: hunt.symbol,
    }),
  }
}

function toHunt(row: MarketRow, flags: { trending?: boolean; meme?: boolean; isNew?: boolean }): GeckoHunt | null {
  const priceCad = num(row.current_price)
  if (!(priceCad > 0) || !row.id) return null
  const change24h = num(row.price_change_percentage_24h)
  const change1h = num(row.price_change_percentage_1h_in_currency)
  const previousClose = change24h !== 0 ? priceCad / (1 + change24h / 100) : priceCad
  const symbol = paperSymbol(row.symbol || row.id)
  const isMeme = Boolean(flags.meme) || isMemeTicker(symbol, row.name)
  const isNew =
    Boolean(flags.isNew) || isFreshDate(row.atl_date, 60) || (num(row.market_cap_rank) || 9999) > 400
  const isTrending = Boolean(flags.trending)
  return scored({
    id: row.id,
    symbol,
    name: String(row.name || symbol),
    priceCad,
    previousClose,
    change1h,
    change24h,
    volumeCad: num(row.total_volume),
    isMeme,
    isTrending,
    isNew,
  })
}

async function markets(params: string): Promise<MarketRow[]> {
  const body = await geckoJson(`/coins/markets?vs_currency=cad&price_change_percentage=1h,24h&${params}`)
  return Array.isArray(body) ? (body as MarketRow[]) : []
}

export async function huntNewAndMemeCoins(limit = 12, extraSymbols: string[] = []): Promise<GeckoHunt[]> {
  const byId = new Map<string, GeckoHunt>()
  const add = (row: MarketRow, flags: { trending?: boolean; meme?: boolean; isNew?: boolean }) => {
    const hunt = toHunt(row, flags)
    if (!hunt) return
    const prev = byId.get(hunt.id)
    byId.set(
      hunt.id,
      scored({
        ...hunt,
        isMeme: hunt.isMeme || Boolean(prev?.isMeme),
        isTrending: hunt.isTrending || Boolean(prev?.isTrending),
        isNew: hunt.isNew || Boolean(prev?.isNew),
        volumeCad: Math.max(hunt.volumeCad, prev?.volumeCad || 0),
      })
    )
  }

  const pull = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (err) {
      console.error(`[tradebot/gecko] ${label}`, err)
    }
    await pause()
  }

  await pull('trending', async () => {
    const trending = (await geckoJson('/search/trending')) as {
      coins?: Array<{ item?: { id?: string } }>
    }
    const ids = (trending.coins || []).map((c) => c.item?.id).filter((id): id is string => Boolean(id))
    if (ids.length) {
      for (const row of await markets(`ids=${encodeURIComponent(ids.join(','))}&per_page=25`)) {
        add(row, { trending: true })
      }
    }
  })

  await pull('new-listings', async () => {
    const newest = (await geckoJson('/coins/list/new')) as Array<{ id?: string }>
    const ids = (Array.isArray(newest) ? newest : [])
      .map((c) => c.id)
      .filter((id): id is string => Boolean(id))
      .slice(0, 30)
    if (ids.length) {
      for (const row of await markets(`ids=${encodeURIComponent(ids.join(','))}&per_page=30`)) {
        add(row, { isNew: true })
      }
    }
  })

  await pull('recent-gecko', async () => {
    for (const row of await markets('order=gecko_desc&per_page=40')) {
      add(row, { isNew: true })
    }
  })

  await pull('meme-token', async () => {
    for (const row of await markets('category=meme-token&order=volume_desc&per_page=40')) {
      add(row, { meme: true })
    }
  })

  await pull('solana-meme', async () => {
    for (const row of await markets('category=solana-meme-coins&order=volume_desc&per_page=30')) {
      add(row, { meme: true })
    }
  })

  await pull('gainers', async () => {
    for (const row of await markets('order=percent_change_24h_desc&per_page=40')) {
      add(row, {})
    }
  })

  const have = new Set<string>()
  byId.forEach((h) => have.add(h.symbol))
  for (const raw of extraSymbols) {
    const base = raw.trim().toUpperCase().replace(/-CAD$/, '')
    const symbol = paperSymbol(base)
    if (!base || have.has(symbol)) continue
    await pull(`seed-${base}`, async () => {
      const found = (await geckoJson(`/search?query=${encodeURIComponent(base)}`)) as {
        coins?: Array<{ id?: string; symbol?: string }>
      }
      const coins = found.coins || []
      const match =
        coins.find((c) => String(c.symbol || '').toUpperCase() === base) || coins[0]
      if (!match?.id) return
      for (const row of await markets(`ids=${encodeURIComponent(match.id)}&per_page=1`)) {
        add(row, { meme: isMemeTicker(symbol, row.name) })
      }
    })
  }

  const hunts: GeckoHunt[] = []
  byId.forEach((v) => hunts.push(v))
  const filtered = hunts.filter((c) => c.symbol !== 'USDT-CAD' && c.symbol !== 'USDC-CAD')
  const seedSet = new Set(
    extraSymbols.map((s) => paperSymbol(s.trim().toUpperCase().replace(/-CAD$/, '')))
  )
  const seeds = filtered.filter((h) => seedSet.has(h.symbol))
  const rest = filtered.filter((h) => !seedSet.has(h.symbol)).sort((a, b) => b.score - a.score)
  return [...seeds, ...rest].slice(0, Math.max(limit, seeds.length))
}

export async function fetchGeckoDailyBars(coinId: string, symbol: string): Promise<{ quote: EquityQuote; bars: DailyBar[] }> {
  const body = (await geckoJson(`/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=cad&days=30`)) as {
    prices?: Array<[number, number]>
  }
  const prices = Array.isArray(body.prices) ? body.prices : []
  const bars: DailyBar[] = []
  for (const pair of prices) {
    const t = Number(pair[0])
    const c = Number(pair[1])
    if (!(t > 0) || !(c > 0)) continue
    bars.push({ t, o: c, h: c, l: c, c, v: 0 })
  }
  const last = bars[bars.length - 1]
  if (!last) throw new Error(`No CoinGecko bars for ${symbol}`)
  const prev = bars.length > 1 ? bars[bars.length - 2].c : last.c
  return {
    quote: {
      symbol,
      price: last.c,
      previousClose: prev,
      currency: 'CAD',
      source: 'coingecko',
      asOf: new Date().toISOString(),
    },
    bars,
  }
}
