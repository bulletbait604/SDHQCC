import test from 'node:test'
import assert from 'node:assert/strict'
import { displayCryptoSymbol, isCryptoSymbol, isFxOrStableWsname } from '@/lib/tradebot/crypto'

test('crypto paper tickers are BASE-CAD', () => {
  assert.equal(isCryptoSymbol('BTC-CAD'), true)
  assert.equal(isCryptoSymbol('DOGE-CAD'), true)
  assert.equal(isCryptoSymbol('VFV.TO'), false)
  assert.equal(isCryptoSymbol('SHOP.TO'), false)
})

test('Kraken wsnames map onto CAD paper symbols', () => {
  assert.equal(displayCryptoSymbol('XBT/CAD'), 'BTC-CAD')
  assert.equal(displayCryptoSymbol('ETH/CAD'), 'ETH-CAD')
  assert.equal(displayCryptoSymbol('XDG/CAD'), 'DOGE-CAD')
  assert.equal(displayCryptoSymbol('SOL/USD'), 'SOL-CAD')
})

test('FX and stables stay off the crypto sleeve', () => {
  assert.equal(isFxOrStableWsname('EUR/CAD'), true)
  assert.equal(isFxOrStableWsname('USD/CAD'), true)
  assert.equal(isFxOrStableWsname('USDT/CAD'), true)
  assert.equal(isFxOrStableWsname('ETH/CAD'), false)
})
