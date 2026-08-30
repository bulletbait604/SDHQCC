import test from 'node:test'
import assert from 'node:assert/strict'
import { formatTagsForClipboard, sanitizeGeneratedTag } from '@/lib/home/tagUtils'

test('YouTube tags keep spaces and copy comma-separated without hashtags', () => {
  assert.equal(sanitizeGeneratedTag('#Minecraft Survival', 'youtube-shorts'), 'minecraft survival')
  assert.equal(sanitizeGeneratedTag('fortnite_highlights', 'youtube-long'), 'fortnite highlights')
  assert.equal(
    formatTagsForClipboard('youtube-shorts', ['#gaming', 'minecraft survival', 'gaming']),
    'gaming, minecraft survival'
  )
})

test('TikTok tags copy as space-separated hashtags', () => {
  assert.equal(sanitizeGeneratedTag('for you', 'tiktok'), 'foryou')
  assert.equal(
    formatTagsForClipboard('tiktok', ['fyp', 'gaming']),
    '#fyp #gaming'
  )
})
