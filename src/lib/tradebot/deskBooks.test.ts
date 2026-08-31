import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PAPER_LEDGER_ID,
  LIVE_LEDGER_ID,
  bookIdForMode,
  cadFromKrakenBalance,
  applyKrakenCash,
} from '@/lib/tradebot/deskBooks'

test('Fake and Real use different ledger ids', () => {
  assert.equal(bookIdForMode(false), PAPER_LEDGER_ID)
  assert.equal(bookIdForMode(true), LIVE_LEDGER_ID)
  assert.notEqual(PAPER_LEDGER_ID, LIVE_LEDGER_ID)
})

test('reads Kraken ZCAD and does not treat a missing field as a fake book', () => {
  assert.equal(cadFromKrakenBalance({ ZCAD: '50.12' }), 50.12)
  assert.equal(cadFromKrakenBalance({ CAD: 50 }), 50)
  assert.equal(cadFromKrakenBalance({ XXBT: '0.01', ZCAD: '0' }), 0)
})

test('first Real sync stamps starting equity from Kraken cash', () => {
  const book = { cash: 135, startingEquity: 0, dayStartEquity: 0, dayStartDate: '' }
  applyKrakenCash(book, 50, '2026-08-31')
  assert.equal(book.cash, 50)
  assert.equal(book.startingEquity, 50)
  assert.equal(book.dayStartEquity, 50)
})

test('later Real syncs update cash only, not the Fake 135 start', () => {
  const book = { cash: 50, startingEquity: 50, dayStartEquity: 50, dayStartDate: '2026-08-31' }
  applyKrakenCash(book, 48.2, '2026-08-31')
  assert.equal(book.cash, 48.2)
  assert.equal(book.startingEquity, 50)
})
