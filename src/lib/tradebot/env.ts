export function finnhubApiKey(): string | undefined {
  return (process.env.FINNHUB_API_KEY || '').trim() || undefined
}

export function bitbuyApiConfigured(): boolean {
  const key = (process.env.BITBUY_API_KEY || '').trim()
  const secret = (process.env.BITBUY_API_SECRET || '').trim()
  return Boolean(key && secret)
}

/** Estimated round-trip taker fees in basis points per venue leg. */
export function tradebotFeeBps(): { kraken: number; coingecko: number; bitbuy: number } {
  return {
    kraken: Number(process.env.TRADEBOT_KRAKEN_FEE_BPS ?? 40),
    coingecko: 0,
    bitbuy: Number(process.env.TRADEBOT_BITBUY_FEE_BPS ?? 20),
  }
}
