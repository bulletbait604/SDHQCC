import test from 'node:test'
import assert from 'node:assert/strict'
import { validateShotstackTimeline } from '@/lib/clip-editor/shotstackTimelineValidate'

test('flags clip-level crop and rich-caption root wrap', () => {
  const errors = validateShotstackTimeline({
    tracks: [
      {
        clips: [
          { asset: { type: 'video', src: 'https://x.mp4' }, crop: { top: 0.1 } },
        ],
      },
      {
        clips: [
          {
            asset: {
              type: 'rich-caption',
              src: 'https://x.vtt',
              wrap: true,
            },
          },
        ],
      },
    ],
  })
  assert.ok(errors.some((e) => e.includes('.crop') && e.includes('asset.crop')))
  assert.ok(errors.some((e) => e.includes('background.wrap')))
})
