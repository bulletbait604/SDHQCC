import test from 'node:test'
import assert from 'node:assert/strict'
import {
  POST4ME_ANALYZE_CHUNK_SECONDS,
  pickPost4MeAnalyzeWindow,
  post4meChunkSampleTimestamps,
} from '@/lib/post4meLimits'

test('pickPost4MeAnalyzeWindow uses the full clip when shorter than 5 minutes', () => {
  const w = pickPost4MeAnalyzeWindow(90, () => 0.5)
  assert.equal(w.startSec, 0)
  assert.equal(w.durationSec, 90)
})

test('pickPost4MeAnalyzeWindow picks a 5-minute slice inside a long VOD', () => {
  const start = pickPost4MeAnalyzeWindow(1200, () => 0)
  assert.equal(start.startSec, 0)
  assert.equal(start.durationSec, POST4ME_ANALYZE_CHUNK_SECONDS)

  const end = pickPost4MeAnalyzeWindow(1200, () => 1)
  assert.equal(end.startSec, 1200 - POST4ME_ANALYZE_CHUNK_SECONDS)
  assert.equal(end.durationSec, POST4ME_ANALYZE_CHUNK_SECONDS)
})

test('post4meChunkSampleTimestamps stays inside the window', () => {
  const times = post4meChunkSampleTimestamps(100, 300, 12)
  assert.equal(times.length, 12)
  assert.ok(times[0]! >= 100)
  assert.ok(times[times.length - 1]! <= 400)
})
