import test from 'node:test'
import assert from 'node:assert/strict'
import { sizeBuyQuantity, quantityRespectingMinLot, validateTrade, capQtyToCash } from '@/lib/tradebot/guardrails'
import type { TradeOrderProposal } from '@/lib/tradebot/models'

const baseProposal = (): TradeOrderProposal => ({
  ticker: 'VFV.TO',
  action: 'BUY',
  order_type: 'MARKET',
  quantity: 10,
  limit_price: 150,
  stop_loss: 145,
  take_profit: 160,
  reasoning_summary: 'test',
})

test('rejects buy without stop-loss', () => {
  const p = baseProposal()
  p.stop_loss = 0
  const r = validateTrade(p, {
    equity: 100_000,
    cash: 100_000,
    dayStartEquity: 100_000,
    maxDrawdownPct: 5,
    maxAssetWeightPct: 15,
    dailyProfitLockPct: 10,
    positionQty: 0,
    positionAvg: 0,
    lastPrice: 150,
  })
  assert.equal(r.ok, false)
  assert.ok(r.reasons.some((x) => /stop-loss/i.test(x)))
})

test('rejects buy over 15% book weight', () => {
  const p = baseProposal()
  p.quantity = 200
  const r = validateTrade(p, {
    equity: 100_000,
    cash: 100_000,
    dayStartEquity: 100_000,
    maxDrawdownPct: 5,
    maxAssetWeightPct: 15,
    dailyProfitLockPct: 10,
    positionQty: 0,
    positionAvg: 0,
    lastPrice: 150,
  })
  assert.equal(r.ok, false)
  assert.ok(r.reasons.some((x) => /15%/i.test(x)))
})

test('halts when daily drawdown is 8%+', () => {
  const p = baseProposal()
  const r = validateTrade(p, {
    equity: 91_500,
    cash: 91_500,
    dayStartEquity: 100_000,
    maxDrawdownPct: 8,
    maxAssetWeightPct: 15,
    dailyProfitLockPct: 10,
    positionQty: 0,
    positionAvg: 0,
    lastPrice: 150,
  })
  assert.equal(r.ok, false)
  assert.ok(r.reasons.some((x) => /drawdown/i.test(x)))
})

test('sizing respects 15% cap', () => {
  const qty = sizeBuyQuantity({
    equity: 100_000,
    riskPct: 1,
    atr: 0.1,
    atrMultiplier: 2,
    price: 150,
    maxAssetWeightPct: 15,
  })
  assert.ok(qty * 150 <= 15_000 + 1)
})

test('locks new buys once daily profit hits the target', () => {
  const p = baseProposal()
  const r = validateTrade(p, {
    equity: 111,
    cash: 111,
    dayStartEquity: 100,
    maxDrawdownPct: 5,
    maxAssetWeightPct: 25,
    dailyProfitLockPct: 10,
    positionQty: 0,
    positionAvg: 0,
    lastPrice: 150,
  })
  assert.equal(r.ok, false)
  assert.ok(r.reasons.some((x) => /profit lock/i.test(x)))
})

test('hold does not require a stop', () => {
  const p = baseProposal()
  p.action = 'HOLD'
  p.stop_loss = 0
  p.quantity = 0
  const r = validateTrade(p, {
    equity: 100_000,
    cash: 100_000,
    dayStartEquity: 100_000,
    maxDrawdownPct: 5,
    maxAssetWeightPct: 15,
    dailyProfitLockPct: 10,
    positionQty: 0,
    positionAvg: 0,
    lastPrice: 150,
  })
  assert.equal(r.ok, true)
})

test('does not bump to the exchange minimum when that blows the cap', () => {
  assert.equal(
    quantityRespectingMinLot({ qty: 0.0004, minLot: 0.02, price: 4000, cash: 100, maxNotional: 45 }),
    0
  )
})

test('keeps sub-0.001 BTC size instead of rounding it to zero', () => {
  const qty = sizeBuyQuantity({
    equity: 100,
    riskPct: 2,
    atr: 1600,
    atrMultiplier: 1,
    price: 160_000,
    maxAssetWeightPct: 45,
  })
  assert.ok(qty > 0)
  assert.ok(qty * 160_000 <= 45 + 0.01)
})

test('caps buy size to CAD cash after maker fee', () => {
  const qty = capQtyToCash(10_000, 0.2, 50, 40)
  assert.ok(qty * 0.2 * 1.004 <= 50 * 0.94 + 0.01)
  assert.equal(capQtyToCash(10, 1, 0, 40), 0)
})
