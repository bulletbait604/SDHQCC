import { finnhubApiKey } from '@/lib/tradebot/env'
import { STOCK_WATCHLIST } from '@/lib/tradebot/watchlist'

type FinnhubQuoteResponse = {
  c?: number
  d?: number
  dp?: number
  h?: number
  l?: number
  o?: number
  pc?: number
  t?: number
}

export type FinnhubStockQuote = {
  symbol: string
  label: string
  priceUsd: number
  changePct: number
  open: number
  high: number
  low: number
  prevClose: number
}

export function isFinnhubConfigured(): boolean {
  return Boolean(finnhubApiKey())
}

export async function fetchFinnhubStockQuotes(): Promise<FinnhubStockQuote[]> {
  const token = finnhubApiKey()
  if (!token) return []

  const quotes: FinnhubStockQuote[] = []
  for (const stock of STOCK_WATCHLIST) {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(stock.symbol)}&token=${encodeURIComponent(token)}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      console.warn(`[tradebot] Finnhub ${stock.symbol} HTTP ${res.status}`)
      continue
    }
    const data = (await res.json()) as FinnhubQuoteResponse
    const priceUsd = data.c ?? 0
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) continue
    quotes.push({
      symbol: stock.symbol,
      label: stock.label,
      priceUsd,
      changePct: data.dp ?? 0,
      open: data.o ?? priceUsd,
      high: data.h ?? priceUsd,
      low: data.l ?? priceUsd,
      prevClose: data.pc ?? priceUsd,
    })
    await new Promise((r) => setTimeout(r, 1100))
  }
  return quotes
}
