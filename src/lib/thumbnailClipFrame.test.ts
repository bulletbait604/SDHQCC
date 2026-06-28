import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clampSeekSeconds,
  parseBestMomentTimestamp,
} from '@/lib/thumbnailClipFrame'

test('parseBestMomentTimestamp parses mm:ss', () => {
  assert.equal(parseBestMomentTimestamp('1:23'), 83)
  assert.equal(parseBestMomentTimestamp('0:45'), 45)
})

test('parseBestMomentTimestamp parses h:mm:ss', () => {
  assert.equal(parseBestMomentTimestamp('1:02:03'), 3723)
})

test('parseBestMomentTimestamp falls back for invalid input', () => {
  assert.equal(parseBestMomentTimestamp('near the end', 100), 5)
})

test('clampSeekSeconds stays inside duration', () => {
  assert.equal(clampSeekSeconds(999, 60), 59.95)
})
