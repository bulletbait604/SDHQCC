import test from 'node:test'
import assert from 'node:assert/strict'
import { checkRateLimit } from './rateLimit'
import { createFakeDb } from '../test/fakeDb'

test('allows up to the limit per window, then 429s, then resets next window', async () => {
  const db = createFakeDb()
  const nowMs = 1_800_000_000_000
  const o = { limit: 2, windowSec: 60, nowMs, db }
  assert.equal((await checkRateLimit('tags', 'Alice', o)).ok, true)
  assert.equal((await checkRateLimit('tags', 'alice', o)).ok, true)
  const third = await checkRateLimit('tags', 'alice', o)
  assert.equal(third.ok, false)
  if (!third.ok) assert.ok(third.retryAfterSec > 0 && third.retryAfterSec <= 60)
  assert.equal((await checkRateLimit('post4me', 'alice', o)).ok, true)
  assert.equal((await checkRateLimit('tags', 'alice', { ...o, nowMs: nowMs + 60_000 })).ok, true)
})

test('fails open when the DB errors', async () => {
  const db = { collection() { throw new Error('down') } } as any
  assert.equal((await checkRateLimit('tags', 'a', { db })).ok, true)
})
