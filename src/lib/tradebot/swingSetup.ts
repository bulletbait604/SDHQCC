import type { DailyBar } from '@/lib/tradebot/quotes'
import { KRAKEN_MAKER_BPS_DEFAULT, KRAKEN_TAKER_BPS_DEFAULT, minTakePct, roundTripPct } from '@/lib/tradebot/fees'
import { ema, macdHistogram, rsi } from '@/lib/tradebot/indicators'
import { liveBuyOk } from '@/lib/tradebot/liveTapeRank'
import { parseVolatility, type VolatilityLevel, volatilityProfile } from '@/lib/tradebot/volatility'

const HOUR_MS = 60 * 60 * 1000
const MIN_NET_RR = 2

export function barsToHourly(bars: DailyBar[]): DailyBar[] {
  const out: DailyBar[] = []
  let bucket = -1
  let cur: DailyBar | null = null
  for (const b of bars) {
    if (!(b.c > 0) || !(b.t > 0)) continue
    const k = Math.floor(b.t / HOUR_MS)
    if (k !== bucket) {
      if (cur) out.push(cur)
      bucket = k
      cur = { t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }
    } else if (cur) {
      cur.h = Math.max(cur.h, b.h)
      cur.l = Math.min(cur.l, b.l)
      cur.c = b.c
      cur.v += b.v
    }
  }
  if (cur) out.push(cur)
  return out
}

export function higherTfUptrend(closes: number[]): boolean {
  if (closes.length < 24) return false
  const e9 = ema(closes, 9)
  const e21 = ema(closes, 21)
  const px = closes[closes.length - 1]
  return e9 != null && e21 != null && px > 0 && e9 > e21 && px > e21
}

export function bullishReversal(bar: { o: number; h: number; l: number; c: number }): boolean {
  if (!(bar.c > 0) || !(bar.h > bar.l) || !(bar.o > 0)) return false
  const closeLoc = (bar.c - bar.l) / (bar.h - bar.l)
  return bar.c >= bar.o && closeLoc >= 0.55
}

export function recentSwingLow(bars: DailyBar[], lookback = 16): number | null {
  const slice = bars.slice(Math.max(0, bars.length - lookback - 1), -1)
  if (slice.length < 6) return null
  let lo = Infinity
  for (const b of slice) {
    if (b.l > 0 && b.l < lo) lo = b.l
  }
  return Number.isFinite(lo) ? lo : null
}

export function recentSwingHigh(bars: DailyBar[], lookback = 28): number | null {
  const slice = bars.slice(Math.max(0, bars.length - lookback - 1), -1)
  if (slice.length < 6) return null
  let hi = 0
  for (const b of slice) {
    if (b.h > hi) hi = b.h
  }
  return hi > 0 ? hi : null
}

export function afterFeeRR(takePct: number, stopPct: number, makerBps = KRAKEN_MAKER_BPS_DEFAULT, takerBps = KRAKEN_TAKER_BPS_DEFAULT): number {
  const win = takePct - roundTripPct(makerBps, makerBps)
  const lose = stopPct + roundTripPct(makerBps, takerBps)
  if (!(lose > 0) || !(win > 0)) return 0
  return win / lose
}

export type SwingEntry = {
  ok: boolean
  stopPct: number
  takePct: number
  reason: string
  scoreBoost: number
}

function nearSwingPct(level: VolatilityLevel): number {
  if (level === 'low') return 0.012
  if (level === 'high') return 0.022
  return 0.016
}

export function swingEntry(input: {
  symbol: string
  bars15: DailyBar[]
  price: number
  dayChangePct: number
  spreadPct?: number
  btcHourCloses?: number[]
  volatility?: VolatilityLevel
}): SwingEntry {
  const fail = (reason: string): SwingEntry => ({ ok: false, stopPct: 0, takePct: 0, reason, scoreBoost: 0 })
  const vol = volatilityProfile(parseVolatility(input.volatility))
  const bars = input.bars15.filter((b) => b.c > 0 && b.h >= b.l)
  if (bars.length < 40) return fail('Not enough 15m history to read the swing.')
  const closes = bars.map((b) => b.c)
  const lastBar = bars[bars.length - 1]
  const rsiNow = rsi(closes) ?? 52
  const rsiPrev = rsi(closes.slice(0, -1)) ?? rsiNow
  const macdNow = macdHistogram(closes) ?? 0
  const macdPrev = macdHistogram(closes.slice(0, -1)) ?? macdNow

  if (
    !liveBuyOk({
      rsi: rsiNow,
      ema9: ema(closes, 9),
      ema21: ema(closes, 21),
      macd: 0,
      dayChangePct: input.dayChangePct,
      spreadPct: input.spreadPct,
      volatility: vol.level,
    })
  ) {
    return fail('15m trend, RSI pullback, or spread is not a buy.')
  }
  if (!(rsiNow > rsiPrev + 0.4)) return fail('RSI is still falling — wait for the dip to turn.')
  if (macdNow + 1e-9 < macdPrev && macdNow < 0.02) return fail('MACD is still rolling over.')
  if (!bullishReversal(lastBar)) return fail('No bullish reversal bar off the pullback.')

  const hourly = barsToHourly(bars)
  const hourCloses = hourly.map((b) => b.c)
  if (!higherTfUptrend(hourCloses)) return fail('Hourly trend is not up. No countertrend scalps.')

  const isBtc = input.symbol.toUpperCase() === 'BTC-CAD'
  if (!isBtc && input.btcHourCloses && input.btcHourCloses.length >= 24) {
    if (!higherTfUptrend(input.btcHourCloses)) return fail('Bitcoin hourly trend is down — skip alts.')
  }

  const swingLow = recentSwingLow(bars)
  const swingHigh = recentSwingHigh(bars)
  if (!(swingLow && swingLow > 0)) return fail('No clear swing low to buy against.')
  const px = input.price > 0 ? input.price : lastBar.c
  const distLow = (px - swingLow) / px
  if (distLow < -0.004) return fail('Price already broke the swing low.')
  if (distLow > nearSwingPct(vol.level)) return fail('Price is mid-range, not at the dip.')

  const underLow = 0.0025
  let stopPct = (px - swingLow * (1 - underLow)) / px
  const minStop = vol.stopPct * 0.75
  const maxStop = vol.stopPct * 1.35
  if (stopPct > maxStop) return fail('Swing low is too far — stop would be sloppy.')
  stopPct = Math.max(minStop, Math.min(maxStop, stopPct))

  const floorTake = Math.max(vol.takePct, minTakePct())
  let takePct = floorTake
  if (swingHigh && swingHigh > px) {
    const toHigh = (swingHigh - px) / px
    if (toHigh >= floorTake * 0.9) takePct = Math.min(Math.max(toHigh, floorTake), vol.takePct * 1.35)
  }

  const rr = afterFeeRR(takePct, stopPct)
  if (rr < MIN_NET_RR) return fail(`After-fee reward/risk ${rr.toFixed(2)} is below ${MIN_NET_RR}.`)

  const closeness = Math.max(0, nearSwingPct(vol.level) - Math.max(0, distLow))
  const scoreBoost = closeness * 80 + (rsiNow - rsiPrev) * 0.25
  const name = input.symbol.replace(/-CAD$/i, '')
  return {
    ok: true,
    stopPct,
    takePct,
    scoreBoost,
    reason: `${name}: hourly trend up, 15m reversal off the swing low, RSI turning up. Stop ${(stopPct * 100).toFixed(1)}% / take ${(takePct * 100).toFixed(1)}%.`,
  }
}
