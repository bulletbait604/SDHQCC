import test from 'node:test'
import assert from 'node:assert/strict'
import { parseVolatility, volatilityProfile } from '@/lib/tradebot/volatility'
import { liveBuyOk, liveEntryScore } from '@/lib/tradebot/liveTapeRank'

test('parses volatility tabs', () => {
  assert.equal(parseVolatility('HIGH'), 'high')
  assert.equal(parseVolatility('nope'), 'medium')
})

test('high hunts more names and wider moves than low', () => {
  const low = volatilityProfile('low')
  const high = volatilityProfile('high')
  assert.ok(high.symbols.length > low.symbols.length)
  assert.ok(high.maxDayChangePct > low.maxDayChangePct)
  assert.ok(high.takePct > low.takePct)
  assert.ok(high.symbols.includes('DOGE-CAD'))
  assert.ok(!low.symbols.includes('DOGE-CAD'))
  assert.equal(low.maxOpen, 1)
  assert.equal(high.maxOpen, 1)
  assert.ok(low.takePct >= 0.056)
  assert.ok(high.takePct >= 0.1)
})

test('rejects an extended spike on every tab', () => {
  const spike = { rsi: 72, ema9: 2, ema21: 1.9, macd: 0.02, dayChangePct: 12 }
  assert.equal(liveBuyOk({ ...spike, volatility: 'low' }), false)
  assert.equal(liveBuyOk({ ...spike, volatility: 'high' }), false)
})

test('high allows a deeper pullback than low', () => {
  const dip = { rsi: 36, ema9: 2, ema21: 1.9, macd: 0.001, dayChangePct: -1.2 }
  assert.equal(liveBuyOk({ ...dip, volatility: 'low' }), false)
  assert.equal(liveBuyOk({ ...dip, volatility: 'high' }), true)
})

test('high ranks a pulled-back alt over an extended bitcoin print', () => {
  const ranked = [
    liveEntryScore({ symbol: 'BTC-CAD', dayChangePct: 7, volume24h: 2_000_000, rsi: 70 }, 'high'),
    liveEntryScore({ symbol: 'DOGE-CAD', dayChangePct: 1.2, volume24h: 80_000, rsi: 34 }, 'high'),
  ]
  assert.ok(ranked[1] > ranked[0])
})
