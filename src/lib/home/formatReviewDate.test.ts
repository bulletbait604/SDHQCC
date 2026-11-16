import test from 'node:test'
import assert from 'node:assert/strict'
import { formatReviewDate } from '@/app/components/AlgorithmInsightsSection'

test('review dates use a readable calendar day, not the raw ISO string', () => {
  assert.equal(formatReviewDate('2026-11-16T18:00:00.000Z'), 'Nov 16, 2026')
  assert.equal(formatReviewDate('Loading...'), 'Loading...')
})
