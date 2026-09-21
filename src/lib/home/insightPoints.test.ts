import test from 'node:test'
import assert from 'node:assert/strict'
import { toInsightPoints } from './insightPoints'

test('toInsightPoints splits sentence blobs into a takeaway plus bullets', () => {
  const points = toInsightPoints(
    'Re-watches drive reach. Completion above 70% expands distribution. Post daily for momentum. Keep titles short.'
  )
  assert.equal(points[0], 'Re-watches drive reach.')
  assert.ok(points.length >= 3)
  assert.ok(points.every((point) => point.length > 0))
})

test('toInsightPoints keeps numbered or bulleted lists intact', () => {
  const points = toInsightPoints(
    '1. Hook in 3 seconds.\n2. Cut every 1-2 seconds.\n3. Use captions.\n4. Add a CTA.'
  )
  assert.equal(points.length, 4)
  assert.equal(points[0], 'Hook in 3 seconds.')
})
