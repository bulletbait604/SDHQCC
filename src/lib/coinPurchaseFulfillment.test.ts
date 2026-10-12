import test from 'node:test'
import assert from 'node:assert/strict'
import { fulfillVerifiedCoinPurchase } from './coinPurchaseFulfillment'
import { createFakeDb } from '../test/fakeDb'

const base = {
  orderId: 'ORDER-1',
  customId: 'alice|coins|medium|30|10|CAD',
  amountValue: '10.00',
  amountCurrency: 'CAD',
  skipActivityLog: true,
}

test('credits coins once for a verified order', async () => {
  const db = createFakeDb()
  const r = await fulfillVerifiedCoinPurchase({ ...base, db })
  assert.deepEqual(r, { ok: true, coins: 30, username: 'alice' })
  assert.equal(db.collection('coinBalances').docs[0].coins, 30)
})

test('replayed webhook does not double-credit', async () => {
  const db = createFakeDb()
  await fulfillVerifiedCoinPurchase({ ...base, db })
  const again = await fulfillVerifiedCoinPurchase({ ...base, db })
  assert.equal(again.ok && again.duplicate, true)
  assert.equal(db.collection('coinBalances').docs[0].coins, 30)
  assert.equal(db.collection('coinTransactions').docs.length, 1)
})

test('concurrent webhook + client completion credit exactly once', async () => {
  const db = createFakeDb()
  const [a, b] = await Promise.all([
    fulfillVerifiedCoinPurchase({ ...base, db }),
    fulfillVerifiedCoinPurchase({ ...base, db, assertUsername: 'alice' }),
  ])
  assert.equal([a, b].filter((r) => r.ok && !r.duplicate).length, 1)
  assert.equal(db.collection('coinBalances').docs[0].coins, 30)
})

test('rejects amount mismatch and wrong account', async () => {
  const db = createFakeDb()
  const cheap = await fulfillVerifiedCoinPurchase({ ...base, db, amountValue: '1.00' })
  assert.equal(cheap.ok, false)
  const other = await fulfillVerifiedCoinPurchase({ ...base, db, assertUsername: 'mallory' })
  assert.equal(other.ok, false)
  if (!other.ok) assert.equal(other.forbidden, true)
  assert.equal(db.collection('coinBalances').docs.length, 0)
})

test('rejects forged coin counts', async () => {
  const db = createFakeDb()
  const r = await fulfillVerifiedCoinPurchase({ ...base, db, customId: 'alice|coins|medium|999|10|CAD' })
  assert.equal(r.ok, false)
})
