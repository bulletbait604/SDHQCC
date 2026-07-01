import { CRYPTO_WATCHLIST } from '@/lib/tradebot/watchlist'

type KrakenTickerResponse = {
  error?: string[]
  result?: Record<
    string,
    {
      a?: [string, string, string]
      b?: [string, string, string]
      c?: [string, string]
    }
  >
}

export type KrakenCadQuote = {
  symbol: string
  label: string
  pair: string
  last: number
  bid: number
  ask: number
}

export async function fetchKrakenCadQuotes(): Promise<KrakenCadQuote[]> {
  const pairs = CRYPTO_WATCHLIST.map((c) => c.krakenPair).join(',')
  const url = `https://api.kraken.com/0/public/Ticker?pair=${encodeURIComponent(pairs)}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Kraken HTTP ${res.status}`)

  const data = (await res.json()) as KrakenTickerResponse
  if (data.error?.length) throw new Error(`Kraken: ${data.error.join(', ')}`)
  if (!data.result) throw new Error('Kraken: empty result')

  const quotes: KrakenCadQuote[] = []
  for (const asset of CRYPTO_WATCHLIST) {
    const row =
      data.result[asset.krakenPair] ??
      Object.entries(data.result).find(([key]) => key.includes(asset.symbol))?.[1]
    if (!row?.c?.[0]) continue
    const last = Number(row.c[0])
    const bid = Number(row.b?.[0] ?? row.c[0])
    const ask = Number(row.a?.[0] ?? row.c[0])
    if (!Number.isFinite(last)) continue
    quotes.push({
      symbol: asset.symbol,
      label: asset.label,
      pair: asset.krakenPair,
      last,
      bid,
      ask,
    })
  }
  return quotes
}
