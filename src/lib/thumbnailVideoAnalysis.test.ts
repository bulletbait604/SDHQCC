import test from 'node:test'
import assert from 'node:assert/strict'
import {
  preprocessThumbnailVideoAnalysisRaw,
  thumbnailVideoAnalysisSchema,
} from '@/lib/thumbnailVideoAnalysisSchema'

test('preprocess truncates verbose colorPalette before schema parse', () => {
  const longPalette = 'vibrant red, deep blue, neon green, '.repeat(20)
  const preprocessed = preprocessThumbnailVideoAnalysisRaw({
    bestMomentTimestamp: '1:23',
    subjectDescription: 'Creator reacting to boss fight',
    emotionalHook: 'Shock and triumph',
    onImageText: ['INSANE CLUTCH'],
    colorPalette: longPalette,
    compositionNotes: 'Subject left, text right',
    viralThumbnailBrief: 'High contrast freeze frame with bold text.',
    algorithmAlignment: 'Matches Shorts hook patterns',
  })

  const parsed = thumbnailVideoAnalysisSchema.parse(preprocessed)
  assert.ok(parsed.colorPalette.length <= 400)
  assert.ok(parsed.colorPalette.length > 0)
})
