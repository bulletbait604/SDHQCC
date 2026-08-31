import { BUY_COOLDOWN_MS, MAX_SPREAD_PCT_DEFAULT, STOP_COOLDOWN_MS } from '@/lib/tradebot/fees'
import { isMemeTicker } from '@/lib/tradebot/opportunity'
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
  return (p.requireEma ? trendUp : true) && rsiOk && macdOk && moveOk && spreadOk
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
  let score = Math.log10(market.volume24h + 10)
  if (p.preferMomentum) {
    score += Math.max(0, market.dayChangePct) * p.moveScoreBoost
    if (isMemeTicker(market.symbol)) score += 6
    if (isMajorCad(market.symbol)) score += p.majorScoreBoost
    if (market.dayChangePct > p.maxDayChangePct * 0.85) score -= 4
  } else {
    const pullback = Math.max(0, p.rsiMax - rsi)
    score += pullback * 0.45
    if (isMajorCad(market.symbol)) score += p.majorScoreBoost
    if (market.dayChangePct > 0 && market.dayChangePct < p.maxDayChangePct * 0.35) score += 0.4
    if (market.dayChangePct > p.maxDayChangePct * 0.55) score -= 3
    score += Math.max(0, -market.dayChangePct) * p.moveScoreBoost
  }
  return Number(score.toFixed(3))
}

export function liveHotScore(
  market: { symbol: string; dayChangePct: number; volume24h: number },
  extra?: { newsTone?: string; change1h?: number }
): number {
  let score = Math.log10(market.volume24h + 10) + Math.max(0, market.dayChangePct) * 0.45
  if (isMajorCad(market.symbol)) score -= 5
  if (isMemeTicker(market.symbol)) score += 6
  if (extra?.newsTone === 'positive') score += 8
  if (extra?.newsTone === 'negative') score -= 20
  if ((extra?.change1h || 0) > 0.8) score += (extra?.change1h || 0) * 0.5
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

/** Prefer the held coin, then (on High) the hottest mover, else BTC. */
export function featuredLiveMark<T extends { symbol: string; dayChangePct?: number }>(
  marks: T[],
  held: string[] = [],
  preferHot = false
): T | undefined {
  if (!marks.length) return undefined
  const bySym = new Map(marks.map((m) => [m.symbol.toUpperCase(), m]))
  for (const symbol of held) {
    const m = bySym.get(symbol.trim().toUpperCase())
    if (m) return m
  }
  if (preferHot) {
    const ranked = [...marks].sort((a, b) => Math.abs(b.dayChangePct || 0) - Math.abs(a.dayChangePct || 0))
    const alt = ranked.find((m) => !isMajorCad(m.symbol))
    if (alt) return alt
    return ranked[0]
  }
  return bySym.get('BTC-CAD') || bySym.get('ETH-CAD') || marks[0]
}

function mostCommonReason(reasons: string[]): string {
  const counts: Record<string, number> = {}
  for (const reason of reasons) {
    const key = reason.trim()
    if (!key) continue
    counts[key] = (counts[key] || 0) + 1
  }
  let best = ''
  let n = 0
  for (const reason of Object.keys(counts)) {
    const count = counts[reason]
    if (count > n) {
      best = reason
      n = count
    }
  }
  return best
}

function coinLabel(symbol: string): string {
  return symbol.replace(/-CAD$/i, '')
}

/** Plain-language why this tick did not buy. */
export function deskWaitNote(input: {
  engineOn: boolean
  liveMode: boolean
  halted: boolean
  haltReason: string
  profitLocked: boolean
  holding: number
  maxOpen: number
  cash: number
  pendingSymbols: string[]
  cooldown: boolean
  skipReasons: string[]
  buyError?: string
}): string {
  if (!input.engineOn) {
    return input.liveMode
      ? 'Real is selected but OFF. Press ON to place Kraken orders — switching to Real always turns the desk off first.'
      : 'Fake is selected but OFF. Press ON to allow practice buys.'
  }
  if (input.buyError) return input.buyError
  if (input.halted) return input.haltReason || 'Day halt. No new trades.'
  if (input.profitLocked) return 'Hit the daily profit ceiling. No new buys until tomorrow.'
  if (input.pendingSymbols.length) {
    return `Maker buy resting for ${input.pendingSymbols.map(coinLabel).join(', ')}. Waiting for a fill — that is a trade in progress.`
  }
  if (input.holding >= input.maxOpen) return 'Already in one swing. Waiting for take or stop.'
  if (input.cooldown) return '20-minute cooldown after the last buy.'
  if (input.cash < 5) return 'Not enough CAD cash to size a ticket.'
  return mostCommonReason(input.skipReasons) || 'Hunting smaller Kraken names for news and live moves.'
}
