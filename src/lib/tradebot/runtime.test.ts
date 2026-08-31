import test from 'node:test'
import assert from 'node:assert/strict'
import { trailStops } from '@/lib/tradebot/trail'

test('does not trail while a stop would still be inside fees', () => {
  const book = {
    positions: [{ symbol: 'ETH-CAD', avgPrice: 100, stopLoss: 98.2 }],
  }
  const moved = trailStops(book, { 'ETH-CAD': 101.5 }, { activatePct: 0.028, trailPct: 0.016 })
  assert.equal(moved.length, 0)
  assert.equal(book.positions[0].stopLoss, 98.2)
})

test('ratchets the stop to at least fee breakeven and never lowers it', () => {
  const book = {
    positions: [{ symbol: 'ETH-CAD', avgPrice: 100, stopLoss: 98.2 }],
  }
  const moved = trailStops(book, { 'ETH-CAD': 104 }, { activatePct: 0.028, trailPct: 0.016, makerBps: 40, takerBps: 80 })
  assert.equal(moved[0], 'ETH-CAD')
  const trailed = Number((104 * (1 - 0.016)).toFixed(6))
  const breakeven = Number((100 * 0.012 + 100).toFixed(6))
  assert.equal(book.positions[0].stopLoss, Math.max(trailed, breakeven))
  const later = trailStops(book, { 'ETH-CAD': 102 }, { activatePct: 0.028, trailPct: 0.016 })
  assert.equal(later.length, 0)
  assert.equal(book.positions[0].stopLoss, Math.max(trailed, breakeven))
})
