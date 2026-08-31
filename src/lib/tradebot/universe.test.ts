import test from 'node:test'
import assert from 'node:assert/strict'
import { isNewListing, listedSymbol, parseTmxDirectory, shouldSkipInstrument } from '@/lib/tradebot/universe'

test('skips warrants, rights, and USD class shares', () => {
  assert.equal(shouldSkipInstrument('ABC.WT'), true)
  assert.equal(shouldSkipInstrument('ABC.U'), true)
  assert.equal(shouldSkipInstrument('ABC.RT'), true)
  assert.equal(shouldSkipInstrument('RY'), false)
  assert.equal(shouldSkipInstrument('FIVD.P'), false)
  assert.equal(shouldSkipInstrument('BTCC.B'), false)
})

test('maps TMX raw symbols onto TSX and TSXV suffixes', () => {
  assert.equal(listedSymbol('RY', 'tsx'), 'RY.TO')
  assert.equal(listedSymbol('FIVD.P', 'tsxv'), 'FIVD.P.V')
})

test('parses TMX directory instruments including new CPC names', () => {
  const listed = parseTmxDirectory(
    {
      results: [
        { symbol: 'RY', name: 'Royal Bank', instruments: [{ symbol: 'RY', name: 'Royal Bank' }] },
        { symbol: 'ABC', name: 'Warrant Co', instruments: [{ symbol: 'ABC.WT', name: 'Warrant' }] },
        { symbol: 'NEW', name: 'New CPC', instruments: [{ symbol: 'NEW.P', name: 'New CPC' }] },
      ],
    },
    'tsxv'
  )
  assert.deepEqual(
    listed.map((r) => r.symbol),
    ['RY.V', 'NEW.P.V']
  )
})

test('bootstrap names are not treated as new listings', () => {
  assert.equal(isNewListing({ seeded: true, firstSeenAt: new Date().toISOString() }), false)
  assert.equal(isNewListing({ seeded: false, firstSeenAt: new Date().toISOString() }), true)
})
