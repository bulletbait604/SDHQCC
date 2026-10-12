import test from 'node:test'
import assert from 'node:assert/strict'
import { spendToolCoins, refundToolCoins } from './spendToolCoins'
import { createFakeDb } from '../../test/fakeDb'
import type { VerifiedUser } from '@/lib/auth/verifyAuth'

const freeUser: VerifiedUser = { id: '1', username: 'Alice', role: 'free', provider: 'kick' }

test('deducts server-defined cost and records a transaction', async () => {
  const db = createFakeDb()
  await db.collection('coinBalances').insertOne({ userId: 'alice', coins: 10, purchasedBalance: 0 })
  const r = await spendToolCoins(freeUser, 'thumbnail-generator', undefined, { db })
  assert.deepEqual(r, { ok: true, deducted: 2, unlimited: false, remainingCoins: 8 })
  const tx = db.collection('coinTransactions').docs
  assert.equal(tx.length, 1)
  assert.equal(tx[0].amount, -2)
})

test('rejects when balance is insufficient and does not change balance', async () => {
  const db = createFakeDb()
  await db.collection('coinBalances').insertOne({ userId: 'alice', coins: 1 })
  const r = await spendToolCoins(freeUser, 'home-clip-analyze', undefined, { db })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.status, 403)
  assert.equal(db.collection('coinBalances').docs[0].coins, 1)
})

test('404 when user has no balance row', async () => {
  const db = createFakeDb()
  const r = await spendToolCoins(freeUser, 'post4me', undefined, { db })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.status, 404)
})

test('subscribers spend nothing', async () => {
  const db = createFakeDb()
  const r = await spendToolCoins({ ...freeUser, role: 'subscriber' }, 'post4me', undefined, { db })
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.deducted, 0)
})

test('concurrent spends cannot overdraw (optimistic lock on coins)', async () => {
  const db = createFakeDb()
  await db.collection('coinBalances').insertOne({ userId: 'alice', coins: 3 })
  const results = await Promise.all([
    spendToolCoins(freeUser, 'home-clip-analyze', undefined, { db }),
    spendToolCoins(freeUser, 'home-clip-analyze', undefined, { db }),
  ])
  assert.equal(results.filter((r) => r.ok).length, 1)
  assert.equal(db.collection('coinBalances').docs[0].coins, 0)
})

test('invalid tool is rejected', async () => {
  const db = createFakeDb()
  const r = await spendToolCoins(freeUser, 'nope' as never, undefined, { db })
  assert.equal(r.ok, false)
})

test('refund ignores non-positive amounts', async () => {
  await refundToolCoins(freeUser, 'post4me', 0)
})
