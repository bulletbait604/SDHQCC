import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clampRenderSeconds,
  expandExcerptWindow,
  excerptMinMaxSeconds,
} from '@/lib/clip-editor/excerptBounds'
import { buildPrimaryClipWindow } from '@/lib/clip-editor/primaryClipWindow'
import { preprocessGeminiVideoRaw } from '@/lib/clip-editor/normalizePlans'
import { geminiVideoPlanSchema } from '@/lib/clip-editor/schemas'

test('TikTok excerpt bounds are 7-15s ideal 14s', () => {
  const bounds = excerptMinMaxSeconds('tiktok', 120)
  assert.equal(bounds.min, 7)
  assert.equal(bounds.ideal, 14)
  assert.equal(bounds.max, 38)
})

test('expandExcerptWindow expands 1s hook spike to platform minimum', () => {
  const expanded = expandExcerptWindow({
    start: 42.5,
    end: 43.5,
    duration: 120,
    platform: 'tiktok',
    hookFocusAt: 42.5,
  })
  const len = expanded.end - expanded.start
  assert.ok(len >= 7, `expected >= 7s, got ${len}`)
  assert.ok(expanded.start <= 42.5 && expanded.end >= 43.5)
})

test('buildPrimaryClipWindow expands short hook ranking segment', () => {
  const window = buildPrimaryClipWindow(
    {
      segments: [
        {
          start: 42.5,
          end: 43.5,
          score: 95,
          reason: 'Mission Complete! Boss Down!',
        },
      ],
    },
    120,
    undefined,
    'tiktok'
  )
  const len = window.end - window.start
  assert.ok(len >= 7, `expected >= 7s, got ${len}`)
})

test('preprocessGeminiVideoRaw expands short primaryWindow for TikTok', () => {
  const raw = preprocessGeminiVideoRaw(
    {
      hookTitle: 'Mission Complete! Boss Down!',
      hookPlan: 'Climactic boss kill',
      layoutTemplate: 'stackedFacecam',
      primaryWindow: { start: 42.5, end: 43.5, confidence: 0.95, reason: 'boss down' },
      renderSeconds: 1,
    },
    120,
    'tiktok'
  ) as Record<string, unknown>

  const parsed = geminiVideoPlanSchema.parse(raw)
  const len = parsed.primaryWindow.end - parsed.primaryWindow.start
  assert.ok(len >= 7, `expected >= 7s, got ${len}`)
  assert.ok((parsed.renderSeconds ?? 0) >= 7)
})

test('clampRenderSeconds enforces TikTok minimum', () => {
  assert.equal(clampRenderSeconds(1, 'tiktok', 120), 7)
  assert.equal(clampRenderSeconds(14, 'tiktok', 120), 14)
})
