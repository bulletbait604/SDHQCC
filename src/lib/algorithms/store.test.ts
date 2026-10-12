import test from 'node:test'
import assert from 'node:assert/strict'
import { readAlgorithmSnapshot, writeAlgorithmSnapshot, ALGORITHM_SEED } from './store'
import { createFakeDb } from '../../test/fakeDb'

test('seed JSON is well under the 16MB Mongo document limit and has platforms', () => {
  assert.ok(Buffer.byteLength(JSON.stringify(ALGORITHM_SEED)) < 1_000_000)
  assert.ok(Object.keys(ALGORITHM_SEED.data).length >= 5)
})

test('empty Mongo returns the bundled seed and seeds the DB once', async () => {
  const db = createFakeDb()
  const r = await readAlgorithmSnapshot(db)
  assert.deepEqual(r, ALGORITHM_SEED)
  const docs = db.collection('algorithm_snapshots').docs
  assert.equal(docs.length, 1)
  assert.equal(docs[0]._id, 'current')
  await readAlgorithmSnapshot(db)
  assert.equal(db.collection('algorithm_snapshots').docs.length, 1)
})

test('writes go to Mongo and are read back', async () => {
  const db = createFakeDb()
  const payload = { data: { tiktok: { keyChanges: 'x' } }, lastUpdated: '2026-10-01T00:00:00Z' }
  await writeAlgorithmSnapshot(payload, db)
  assert.deepEqual(await readAlgorithmSnapshot(db), payload)
})
