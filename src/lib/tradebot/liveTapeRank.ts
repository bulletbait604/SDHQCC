import { BUY_COOLDOWN_MS, MAX_SPREAD_PCT_DEFAULT, STOP_COOLDOWN_MS } from '@/lib/tradebot/fees'
import { isMajorCad, parseVolatility, type VolatilityLevel, volatilityProfile } from '@/lib/tradebot/volatility'

export function liveBuyOk(input: {
  rsi: number
  ema9: number | null
  ema21: number | null
  macd: number
  dayChangePct: number
  spreadPct?: number
  volatility?: VolatilityLevel
}): boolean {
  const p = volatilityProfile(parseVolatility(input.volatility))
  const trendUp = input.ema9 != null && input.ema21 != null && input.ema9 > input.ema21
  if (p.requireEma && !trendUp) return false
  const rsiOk = input.rsi >= p.rsiMin && input.rsi <= p.rsiMax
  const macdOk = input.macd >= 0
  const moveOk = input.dayChangePct >= p.minDayChangePct && input.dayChangePct <= p.maxDayChangePct
  const maxSpread = p.maxSpreadPct ?? MAX_SPREAD_PCT_DEFAULT
  const spreadOk = input.spreadPct == null || input.spreadPct <= maxSpread
  return trendUp && rsiOk && macdOk && moveOk && spreadOk
}

/** Kept for tests; the live tape no longer fade-sells open winners. */
export function liveSellFade(input: { rsi: number; ema9: number | null; ema21: number | null }): boolean {
  return Boolean(input.ema9 != null && input.ema21 != null && input.ema9 < input.ema21 && input.rsi < 50)
}

export function liveEntryScore(
  market: { symbol: string; dayChangePct: number; volume24h: number; rsi?: number },
  volatility: VolatilityLevel = 'medium'
): number {
  const p = volatilityProfile(volatility)
  const rsi = market.rsi ?? (p.rsiMin + p.rsiMax) / 2
  const pullback = Math.max(0, p.rsiMax - rsi)
  let score = pullback * 0.45 + Math.log10(market.volume24h + 10)
  if (isMajorCad(market.symbol)) score += p.majorScoreBoost
  if (market.dayChangePct > 0 && market.dayChangePct < p.maxDayChangePct * 0.35) score += 0.4
  if (market.dayChangePct > p.maxDayChangePct * 0.55) score -= 3
  score += Math.max(0, -market.dayChangePct) * p.moveScoreBoost
  return Number(score.toFixed(3))
}

export function rankLiveBuys<T extends { symbol: string; dayChangePct: number; volume24h: number; score?: number }>(
  markets: T[],
  held: Set<string>
): T[] {
  return markets
    .filter((m) => !held.has(m.symbol) && (m.score || 0) > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
}

export function recentlyBought(
  fills: Array<{ side: string; at: string }>,
  now = Date.now(),
  windowMs = BUY_COOLDOWN_MS
): boolean {
  return fills.some((f) => {
    if (f.side !== 'BUY') return false
    const at = Date.parse(f.at)
    return Number.isFinite(at) && now - at < windowMs
  })
}

export function recentlyStopped(
  fills: Array<{ symbol: string; side: string; reason: string; at: string }>,
  symbol: string,
  now = Date.now(),
  windowMs = STOP_COOLDOWN_MS
): boolean {
  const want = symbol.trim().toUpperCase()
  return fills.some((f) => {
    if (f.side !== 'SELL' || f.symbol.toUpperCase() !== want) return false
    if (!/stop-loss/i.test(f.reason)) return false
    const at = Date.parse(f.at)
    return Number.isFinite(at) && now - at < windowMs
  })
}
