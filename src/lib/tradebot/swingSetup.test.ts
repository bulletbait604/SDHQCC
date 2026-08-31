import test from 'node:test'
import assert from 'node:assert/strict'
import type { DailyBar } from '@/lib/tradebot/quotes'
import { ema } from '@/lib/tradebot/indicators'
import {
  afterFeeRR,
  barsToHourly,
  bullishReversal,
  higherTfUptrend,
  recentSwingLow,
  swingEntry,
} from '@/lib/tradebot/swingSetup'

function bar(i: number, o: number, h: number, l: number, c: number): DailyBar {
  return { t: 1_700_000_000_000 + i * 15 * 60 * 1000, o, h, l, c, v: 10 }
}

/** Rising 15m tape, shallow dip, base, then a green reversal at the low. */
function swingTape(): DailyBar[] {
  const bars: DailyBar[] = []
  let px = 100
  for (let i = 0; i < 120; i++) {
    const n = px * 1.0014
    bars.push(bar(i, px, n * 1.0008, px * 0.9994, n))
    px = n
  }
  for (let i = 0; i < 7; i++) {
    const n = px * 0.9982
    bars.push(bar(120 + i, px, px * 1.0003, n * 0.9996, n))
    px = n
  }
  const base = px
  for (let i = 0; i < 6; i++) {
    const up = i % 2 === 0
    const n = up ? base * 1.0006 : base * 0.9995
    const o = up ? base * 0.9998 : base * 1.0002
    bars.push(bar(127 + i, o, Math.max(o, n) * 1.0004, Math.min(o, n) * 0.9996, n))
  }
  px = bars[bars.length - 1].c
  const low = Math.min(...bars.slice(-14).map((b) => b.l))
  const close = px * 1.0035
  bars.push(bar(133, px * 0.999, close * 1.0005, Math.min(low, px * 0.9988), close))
  return bars
}

test('resamples four 15m bars into one hour', () => {
  const bars = [1, 2, 3, 4].map((i) => bar(i - 1, 10, 12, 9, 11 + i / 10))
  const hourly = barsToHourly(bars)
  assert.equal(hourly.length, 1)
  assert.equal(hourly[0].o, 10)
  assert.equal(hourly[0].c, 11.4)
  assert.equal(hourly[0].h, 12)
  assert.equal(hourly[0].l, 9)
})

test('bullish reversal is a green close in the top of the range', () => {
  assert.equal(bullishReversal({ o: 10, h: 11, l: 9.5, c: 10.8 }), true)
  assert.equal(bullishReversal({ o: 10.8, h: 11, l: 9.5, c: 9.7 }), false)
})

test('hourly uptrend is EMA9 above EMA21 with price on top', () => {
  const tape = swingTape()
  const hourly = barsToHourly(tape).map((b) => b.c)
  assert.equal(higherTfUptrend(hourly), true)
})

test('takes a 15m reversal off the swing low in an hourly uptrend', () => {
  const bars = swingTape()
  const last = bars[bars.length - 1]
  const low = recentSwingLow(bars)
  assert.ok(low && low > 0)
  const got = swingEntry({
    symbol: 'ETH-CAD',
    bars15: bars,
    price: last.c,
    dayChangePct: 0.4,
    spreadPct: 0.08,
    volatility: 'medium',
  })
  assert.equal(got.ok, true, got.reason)
  assert.ok(got.takePct >= 0.056)
  assert.ok(got.stopPct > 0 && got.stopPct < got.takePct)
})

test('rejects mid-range price even if 15m EMAs are still up', () => {
  const bars = swingTape()
  const last = bars[bars.length - 1]
  const got = swingEntry({
    symbol: 'ETH-CAD',
    bars15: bars,
    price: last.c * 1.04,
    dayChangePct: 0.4,
    spreadPct: 0.08,
    volatility: 'medium',
  })
  assert.equal(got.ok, false)
})

test('alts stay flat when bitcoin hourly trend is down', () => {
  const bars = swingTape()
  const last = bars[bars.length - 1]
  const btcDown = Array.from({ length: 40 }, (_, i) => 80_000 - i * 200)
  const got = swingEntry({
    symbol: 'SOL-CAD',
    bars15: bars,
    price: last.c,
    dayChangePct: 0.4,
    spreadPct: 0.08,
    btcHourCloses: btcDown,
    volatility: 'medium',
  })
  assert.equal(got.ok, false)
})

test('after-fee reward/risk on a 7.5% take / 2% stop is at least 2R', () => {
  assert.ok(afterFeeRR(0.075, 0.02) >= 2)
  assert.ok(afterFeeRR(0.024, 0.018) < 2)
})

test('still buys the dip when the 15m EMA has already rolled over', () => {
  const bars: DailyBar[] = []
  let px = 100
  for (let i = 0; i < 240; i++) {
    const n = px * 1.0014
    bars.push(bar(i, px, n * 1.0006, px * 0.9996, n))
    px = n
  }
  for (let i = 0; i < 10; i++) {
    const n = px * 0.998
    bars.push(bar(240 + i, px, px * 1.0003, n * 0.9996, n))
    px = n
  }
  const low = Math.min(...bars.slice(-14).map((b) => b.l), px * 0.9988)
  const close = px * 1.0032
  bars.push(bar(250, px * 0.999, close * 1.0004, Math.min(low, px * 0.9988), close))
  const closes = bars.map((b) => b.c)
  const e9 = ema(closes, 9)
  const e21 = ema(closes, 21)
  assert.ok(e9 != null && e21 != null && e9 < e21, '15m EMA9 should be below EMA21 at the dip')
  const last = bars[bars.length - 1]
  const got = swingEntry({
    symbol: 'ETH-CAD',
    bars15: bars,
    price: last.c,
    dayChangePct: 0.4,
    spreadPct: 0.08,
    volatility: 'medium',
  })
  assert.equal(got.ok, true, got.reason)
})
