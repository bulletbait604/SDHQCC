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
})

test('low rejects a 12% spike that high will take', () => {
  const spike = { rsi: 68, ema9: 2, ema21: 1.9, macd: 0.02, dayChangePct: 12 }
  assert.equal(liveBuyOk({ ...spike, volatility: 'low' }), false)
  assert.equal(liveBuyOk({ ...spike, volatility: 'high' }), true)
})

test('high ranks a wild alt over bitcoin', () => {
  const ranked = [
    liveEntryScore({ symbol: 'BTC-CAD', dayChangePct: 1.1, volume24h: 2_000_000 }, 'high'),
    liveEntryScore({ symbol: 'DOGE-CAD', dayChangePct: 9.4, volume24h: 80_000 }, 'high'),
  ]
  assert.ok(ranked[1] > ranked[0])
})
