import test from 'node:test'
import assert from 'node:assert/strict'
import { geminiVideoPlanSchema } from '@/lib/clip-editor/schemas'
import { preprocessGeminiVideoRaw } from '@/lib/clip-editor/normalizePlans'

test('maps urgent captionStyle to bold', () => {
  const raw = preprocessGeminiVideoRaw(
    {
      hookTitle: 'Big play',
      hookPlan: 'Instant hook',
      captionStyle: 'urgent',
      primaryWindow: { start: 0, end: 20, confidence: 0.9, reason: 'peak' },
    },
    60
  ) as Record<string, unknown>

  const parsed = geminiVideoPlanSchema.parse(raw)
  assert.equal(parsed.captionStyle, 'bold')
})

test('swaps swapped caption and hook styles', () => {
  const raw = preprocessGeminiVideoRaw(
    {
      hookTitle: 'Big play',
      hookPlan: 'Instant hook',
      captionStyle: 'pop',
      hookStyle: 'karaoke',
      primaryWindow: { start: 0, end: 20, confidence: 0.9, reason: 'peak' },
    },
    60
  ) as Record<string, unknown>

  const parsed = geminiVideoPlanSchema.parse(raw)
  assert.equal(parsed.captionStyle, 'karaoke')
  assert.equal(parsed.hookStyle, 'pop')
})
