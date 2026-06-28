import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatYouTubeTagsForCopy,
  normalizeClipAnalysisMetadata,
  stripHashtagsFromDescription,
} from '@/lib/clipAnalyzerMetadata'

test('formats YouTube tags as comma-separated plain text', () => {
  assert.equal(
    formatYouTubeTagsForCopy(['#gaming', 'minecraft', ' Minecraft ', 'gaming']),
    'gaming, minecraft'
  )
})

test('strips trailing hashtag blocks from description', () => {
  const raw =
    'Watch this insane clutch moment.\n\n#gaming #minecraft #shorts #fyp'
  assert.equal(
    stripHashtagsFromDescription(raw),
    'Watch this insane clutch moment.'
  )
})

test('normalizes YouTube Shorts metadata into separate fields', () => {
  const meta = normalizeClipAnalysisMetadata('youtube-shorts', {
    titles: ['#Epic Win Title', 'Second Title Option'],
    description:
      'Best moment from the stream.\n\n#gaming #minecraft #shorts #viral',
    tags: ['#gaming', 'minecraft survival'],
  })

  assert.equal(meta.titles[0], 'Epic Win Title')
  assert.ok(!meta.description.includes('#gaming'))
  assert.ok(meta.tags.includes('gaming'))
  assert.ok(meta.tags.includes('minecraft survival'))
  assert.match(formatYouTubeTagsForCopy(meta.tags), /^gaming, /)
})
