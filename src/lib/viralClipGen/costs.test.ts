import test from 'node:test'
import assert from 'node:assert/strict'
import {
  splitDurationIntoNativeChunks,
  isViralClipDuration,
  isAllowedViralClipImageType,
  VIRAL_CLIP_DURATIONS,
} from '@/lib/viralClipGen/config'
import { VIDEO_GENERATION_COSTS, viralClipGenCoinCost } from '@/lib/viralClipGen/costs'

test('every advertised duration has a coin cost', () => {
  for (const d of VIRAL_CLIP_DURATIONS) {
    assert.equal(typeof VIDEO_GENERATION_COSTS[d], 'number')
    assert.ok(viralClipGenCoinCost(d) > 0)
  }
})

test('isViralClipDuration rejects junk', () => {
  assert.equal(isViralClipDuration(10), true)
  assert.equal(isViralClipDuration(7), false)
  assert.equal(isViralClipDuration('10'), false)
})

test('isAllowedViralClipImageType accepts common stills', () => {
  assert.equal(isAllowedViralClipImageType('image/png'), true)
  assert.equal(isAllowedViralClipImageType('image/jpeg; charset=utf-8'), true)
  assert.equal(isAllowedViralClipImageType('image/svg+xml'), false)
})

test('splitDurationIntoNativeChunks uses 5s and 10s fal clips', () => {
  assert.deepEqual(splitDurationIntoNativeChunks(5), [5])
  assert.deepEqual(splitDurationIntoNativeChunks(10), [10])
  assert.deepEqual(splitDurationIntoNativeChunks(15), [10, 5])
  assert.deepEqual(splitDurationIntoNativeChunks(20), [10, 10])
  assert.deepEqual(splitDurationIntoNativeChunks(30), [10, 10, 10])
})
