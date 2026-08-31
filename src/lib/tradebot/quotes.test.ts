import test from 'node:test'
import assert from 'node:assert/strict'
import { toStooqSymbol, toYahooSymbol } from '@/lib/tradebot/quotes'

test('Yahoo maps TSX class shares to dashed tickers', () => {
  assert.equal(toYahooSymbol('VFV.TO'), 'VFV.TO')
  assert.equal(toYahooSymbol('BTCC.B.TO'), 'BTCC-B.TO')
  assert.equal(toYahooSymbol('ETHH.B.TO'), 'ETHH-B.TO')
})

test('Stooq uses lowercase dashed TSX symbols', () => {
  assert.equal(toStooqSymbol('BTCC.B.TO'), 'btcc-b.to')
})
