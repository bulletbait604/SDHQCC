import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clampSeekSeconds,
  formatTimestampFromSeconds,
  parseBestMomentTimestamp,
  thumbnailSampleTimestamps,
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

test('formatTimestampFromSeconds formats mm:ss and h:mm:ss', () => {
  assert.equal(formatTimestampFromSeconds(45), '0:45')
  assert.equal(formatTimestampFromSeconds(83), '1:23')
  assert.equal(formatTimestampFromSeconds(3723), '1:02:03')
})

test('thumbnailSampleTimestamps skips intro/outro and returns count points', () => {
  const times = thumbnailSampleTimestamps(100, 8)
  assert.equal(times.length, 8)
  assert.ok(times[0]! >= 8)
  assert.ok(times[times.length - 1]! <= 92)
})
