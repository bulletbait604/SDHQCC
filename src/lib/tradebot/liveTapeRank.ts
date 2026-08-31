export function liveBuyOk(input: {
  rsi: number
  ema9: number | null
  ema21: number | null
  macd: number
  dayChangePct: number
}): boolean {
  const trendUp = input.ema9 != null && input.ema21 != null ? input.ema9 > input.ema21 : input.dayChangePct >= 0.6
  const rsiOk = input.rsi >= 38 && input.rsi <= 70
  const notDumping = input.macd >= 0 || input.dayChangePct >= 0.8
  return trendUp && rsiOk && notDumping && input.dayChangePct <= 18
}

export function liveSellFade(input: { rsi: number; ema9: number | null; ema21: number | null }): boolean {
  return Boolean(input.ema9 != null && input.ema21 != null && input.ema9 < input.ema21 && input.rsi < 50)
}

export function rankLiveBuys(
  markets: Array<{ symbol: string; dayChangePct: number; volume24h: number; score?: number }>,
  held: Set<string>
): Array<{ symbol: string; dayChangePct: number; volume24h: number; score?: number }> {
  return markets
    .filter((m) => !held.has(m.symbol) && (m.score || 0) > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
}
