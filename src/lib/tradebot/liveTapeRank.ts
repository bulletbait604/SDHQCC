import { isMajorCad, parseVolatility, type VolatilityLevel, volatilityProfile } from '@/lib/tradebot/volatility'

export function liveBuyOk(input: {
  rsi: number
  ema9: number | null
  ema21: number | null
  macd: number
  dayChangePct: number
  volatility?: VolatilityLevel
}): boolean {
  const p = volatilityProfile(parseVolatility(input.volatility))
  const trendUp =
    input.ema9 != null && input.ema21 != null
      ? input.ema9 > input.ema21
      : !p.requireEma && input.dayChangePct >= p.minDayChangePct
  const emaOk = p.requireEma ? trendUp : trendUp || input.dayChangePct >= p.minDayChangePct
  const rsiOk = input.rsi >= p.rsiMin && input.rsi <= p.rsiMax
  const notDumping = input.macd >= 0 || input.dayChangePct >= p.minDayChangePct + 0.2
  const moveOk = input.dayChangePct >= p.minDayChangePct && input.dayChangePct <= p.maxDayChangePct
  return emaOk && rsiOk && notDumping && moveOk
}

export function liveSellFade(input: { rsi: number; ema9: number | null; ema21: number | null }): boolean {
  return Boolean(input.ema9 != null && input.ema21 != null && input.ema9 < input.ema21 && input.rsi < 50)
}

export function liveEntryScore(
  market: { symbol: string; dayChangePct: number; volume24h: number },
  volatility: VolatilityLevel = 'medium'
): number {
  const p = volatilityProfile(volatility)
  let score = Math.max(0, market.dayChangePct) * p.moveScoreBoost + Math.log10(market.volume24h + 10)
  if (isMajorCad(market.symbol)) score += p.majorScoreBoost
  else if (volatility === 'high') score += Math.max(0, market.dayChangePct) * 0.4
  return Number(score.toFixed(3))
}

export function rankLiveBuys(
  markets: Array<{ symbol: string; dayChangePct: number; volume24h: number; score?: number }>,
  held: Set<string>
): Array<{ symbol: string; dayChangePct: number; volume24h: number; score?: number }> {
  return markets
    .filter((m) => !held.has(m.symbol) && (m.score || 0) > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
}
