import { CRYPTO_WATCHLIST } from '@/lib/tradebot/watchlist'

type CoinGeckoPriceResponse = Record<string, { cad?: number }>

export type CoinGeckoCadQuote = {
  symbol: string
  label: string
  priceCad: number
}

export async function fetchCoinGeckoCadQuotes(): Promise<CoinGeckoCadQuote[]> {
  const ids = CRYPTO_WATCHLIST.map((c) => c.coingeckoId).join(',')
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=cad`
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (res.status === 429) throw new Error('CoinGecko rate limit — try again in a minute')
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)

  const data = (await res.json()) as CoinGeckoPriceResponse
  const quotes: CoinGeckoCadQuote[] = []
  for (const asset of CRYPTO_WATCHLIST) {
    const priceCad = data[asset.coingeckoId]?.cad
    if (typeof priceCad !== 'number' || !Number.isFinite(priceCad)) continue
    quotes.push({ symbol: asset.symbol, label: asset.label, priceCad })
  }
  return quotes
}
