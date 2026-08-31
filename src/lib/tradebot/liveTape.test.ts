import test from 'node:test'
import assert from 'node:assert/strict'
import { rankLiveBuys } from '@/lib/tradebot/liveTapeRank'

test('ranks hot coins and skips names already held', () => {
  const ranked = rankLiveBuys(
    [
      { symbol: 'BTC-CAD', dayChangePct: 6, volume24h: 1_000_000 },
      { symbol: 'PEPE-CAD', dayChangePct: 18, volume24h: 80_000 },
      { symbol: 'SLOW-CAD', dayChangePct: 1, volume24h: 50_000 },
      { symbol: 'HELD-CAD', dayChangePct: 22, volume24h: 40_000 },
    ],
    new Set(['HELD-CAD'])
  )
  assert.equal(ranked[0]?.symbol, 'PEPE-CAD')
  assert.ok(!ranked.some((r) => r.symbol === 'HELD-CAD'))
  assert.ok(!ranked.some((r) => r.symbol === 'SLOW-CAD'))
})
