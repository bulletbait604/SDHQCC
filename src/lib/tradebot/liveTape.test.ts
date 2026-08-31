import test from 'node:test'
import assert from 'node:assert/strict'
import { liveBuyOk, liveSellFade, rankLiveBuys } from '@/lib/tradebot/liveTapeRank'

test('ranks scored coins and skips names already held', () => {
  const ranked = rankLiveBuys(
    [
      { symbol: 'BTC-CAD', dayChangePct: 6, volume24h: 1_000_000, score: 4 },
      { symbol: 'SOL-CAD', dayChangePct: 3, volume24h: 80_000, score: 12 },
      { symbol: 'SLOW-CAD', dayChangePct: 1, volume24h: 50_000, score: 0 },
      { symbol: 'HELD-CAD', dayChangePct: 22, volume24h: 40_000, score: 20 },
    ],
    new Set(['HELD-CAD'])
  )
  assert.equal(ranked[0]?.symbol, 'SOL-CAD')
  assert.ok(!ranked.some((r) => r.symbol === 'HELD-CAD'))
  assert.ok(!ranked.some((r) => r.symbol === 'SLOW-CAD'))
})

test('buys an uptrend with healthy RSI', () => {
  assert.equal(liveBuyOk({ rsi: 55, ema9: 2, ema21: 1.9, macd: 0.01, dayChangePct: 1.2 }), true)
  assert.equal(liveBuyOk({ rsi: 80, ema9: 2, ema21: 1.9, macd: 0.01, dayChangePct: 1.2 }), false)
})

test('sells when the short average drops under the long one', () => {
  assert.equal(liveSellFade({ rsi: 44, ema9: 1.8, ema21: 2 }), true)
  assert.equal(liveSellFade({ rsi: 60, ema9: 2.1, ema21: 2 }), false)
})
