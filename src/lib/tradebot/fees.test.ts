import test from 'node:test'
import assert from 'node:assert/strict'
import {
  KRAKEN_MAKER_BPS_DEFAULT,
  KRAKEN_TAKER_BPS_DEFAULT,
  minTakePct,
  roundTripPct,
  trailActivatePct,
  spreadPct,
} from '@/lib/tradebot/fees'

test('Kraken Pro defaults are 80 taker / 40 maker bps', () => {
  assert.equal(KRAKEN_TAKER_BPS_DEFAULT, 80)
  assert.equal(KRAKEN_MAKER_BPS_DEFAULT, 40)
})

test('taker round-trip is 1.60% and maker round-trip is 0.80%', () => {
  assert.equal(roundTripPct(80, 80), 0.016)
  assert.equal(roundTripPct(40, 40), 0.008)
})

test('min take is 7× maker round-trip (5.6%)', () => {
  assert.equal(minTakePct(), 0.056)
})

test('trail waits until a 1.6% trail still locks a maker/taker round-trip', () => {
  const g = trailActivatePct(0.016)
  assert.ok(g > 0.027 && g < 0.03)
})

test('spread is percent of mid', () => {
  assert.ok(Math.abs(spreadPct(100, 100.4) - 0.3992) < 0.01)
})
