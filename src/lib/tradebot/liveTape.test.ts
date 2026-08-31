import test from 'node:test'
import assert from 'node:assert/strict'
import { liveBuyOk, liveSellFade, rankLiveBuys, recentlyBought, recentlyStopped, featuredLiveMark } from '@/lib/tradebot/liveTapeRank'

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

test('buys a dip while EMA9 is still above EMA21', () => {
  assert.equal(liveBuyOk({ rsi: 40, ema9: 2, ema21: 1.9, macd: 0.01, dayChangePct: 0.4 }), true)
  assert.equal(liveBuyOk({ rsi: 72, ema9: 2, ema21: 1.9, macd: 0.01, dayChangePct: 1.2 }), false)
  assert.equal(liveBuyOk({ rsi: 44, ema9: 1.8, ema21: 1.9, macd: 0.01, dayChangePct: 0.4 }), false)
})

test('rejects a wide bid/ask spread', () => {
  assert.equal(
    liveBuyOk({ rsi: 44, ema9: 2, ema21: 1.9, macd: 0.01, dayChangePct: 0.4, spreadPct: 1.2 }),
    false
  )
})

test('fade helper still detects a broken short average (unused by the live tape)', () => {
  assert.equal(liveSellFade({ rsi: 44, ema9: 1.8, ema21: 2 }), true)
  assert.equal(liveSellFade({ rsi: 60, ema9: 2.1, ema21: 2 }), false)
})

test('rejects a dump even if the short average is still up', () => {
  assert.equal(liveBuyOk({ rsi: 44, ema9: 2, ema21: 1.9, macd: -0.02, dayChangePct: 0.4 }), false)
})

test('cools off the whole book for 20 minutes after a buy', () => {
  const now = Date.parse('2026-08-31T16:00:00.000Z')
  assert.equal(
    recentlyBought([{ side: 'BUY', at: '2026-08-31T15:50:00.000Z' }], now),
    true
  )
  assert.equal(
    recentlyBought([{ side: 'BUY', at: '2026-08-31T15:30:00.000Z' }], now),
    false
  )
})

test('cools off a name after a recent stop-out', () => {
  const now = Date.parse('2026-08-31T16:00:00.000Z')
  assert.equal(
    recentlyStopped(
      [{ symbol: 'ETH-CAD', side: 'SELL', reason: 'Stop-loss 3800', at: '2026-08-31T15:50:00.000Z' }],
      'ETH-CAD',
      now
    ),
    true
  )
  assert.equal(
    recentlyStopped(
      [{ symbol: 'ETH-CAD', side: 'SELL', reason: 'Take-profit 4000', at: '2026-08-31T15:50:00.000Z' }],
      'ETH-CAD',
      now
    ),
    false
  )
})

test('featured live mark prefers the held coin then bitcoin, not the wildest mover', () => {
  const marks = [
    { symbol: 'DOGE-CAD', price: 0.2, dayChangePct: 18 },
    { symbol: 'BTC-CAD', price: 160000, dayChangePct: 0.4 },
    { symbol: 'ETH-CAD', price: 4000, dayChangePct: 1.1 },
  ]
  assert.equal(featuredLiveMark(marks)?.symbol, 'BTC-CAD')
  assert.equal(featuredLiveMark(marks, ['ETH-CAD'])?.symbol, 'ETH-CAD')
})
