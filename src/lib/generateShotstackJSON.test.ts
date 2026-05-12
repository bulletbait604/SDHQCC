import test from 'node:test'
import assert from 'node:assert/strict'
import { generateShotstackJSON } from './generateShotstackJSON'

const safeZone = {
  captionX: 0,
  captionY: -0.12,
  facecamX: 0,
  facecamY: -0.08,
  clearBottomPct: 18,
}

function tracksFor(edit: ReturnType<typeof generateShotstackJSON>) {
  return edit.timeline.tracks as Array<{ clips: Array<Record<string, unknown>> }>
}

function assetType(clip: Record<string, unknown>): string | undefined {
  const asset = clip.asset as Record<string, unknown> | undefined
  return typeof asset?.type === 'string' ? asset.type : undefined
}

test('gameplay stream auto layout renders stacked video layers', () => {
  const edit = generateShotstackJSON({
    sourceUrl: 'https://example.com/source.mp4',
    platform: 'tiktok',
    safeZone,
    editBlueprint: {
      contentType: 'gameplayStream',
      layoutTemplate: 'auto',
      renderSeconds: 8,
      sourceMoments: [{ startSeconds: 2, endSeconds: 10, role: 'hook', focusRegion: 'gameplay' }],
      regions: {
        gameplay: { x: 0, y: 0.18, width: 1, height: 0.82, confidence: 0.9 },
        facecam: { x: 0.72, y: 0.02, width: 0.24, height: 0.22, confidence: 0.86 },
      },
    },
    sourceDurationSeconds: 20,
  })

  assert.equal(edit.metadata.layoutTemplate, 'stackedFacecam')
  const videoTracks = tracksFor(edit).filter((track) => track.clips.some((clip) => assetType(clip) === 'video'))
  assert.equal(videoTracks.length, 2)
  assert.equal(videoTracks[0].clips[0].height, 1220)
  assert.equal(videoTracks[1].clips[0].height, 650)
})

test('source-timed subtitle maps onto reordered final timeline', () => {
  const edit = generateShotstackJSON({
    sourceUrl: 'https://example.com/source.mp4',
    platform: 'youtube',
    safeZone,
    editBlueprint: {
      layoutTemplate: 'fullFrame',
      renderSeconds: 8,
      sourceMoments: [
        { startSeconds: 10, endSeconds: 12, role: 'hook' },
        { startSeconds: 0, endSeconds: 2, role: 'context' },
      ],
      subtitles: [
        {
          text: 'mapped caption',
          sourceStartSeconds: 10.5,
          durationSeconds: 1.4,
          position: 'bottom',
          type: 'subtitle',
        },
      ],
    },
    sourceDurationSeconds: 20,
  })

  const subtitleClip = tracksFor(edit)
    .flatMap((track) => track.clips)
    .find((clip) => {
      const asset = clip.asset as Record<string, unknown> | undefined
      return asset?.type === 'text' && asset.text === 'mapped caption'
    })

  assert.ok(subtitleClip)
  assert.equal(subtitleClip.start, 0.5)
})

test('rich captions replace fallback subtitle text clips', () => {
  const edit = generateShotstackJSON({
    sourceUrl: 'https://example.com/source.mp4',
    platform: 'reels',
    safeZone,
    editBlueprint: {
      layoutTemplate: 'focusCrop',
      richCaptionUrl: 'https://example.com/captions.vtt',
      renderSeconds: 8,
      sourceMoments: [{ startSeconds: 0, endSeconds: 8, role: 'hook', focusRegion: 'speaker' }],
      regions: {
        speaker: { x: 0.3, y: 0.05, width: 0.4, height: 0.8, confidence: 0.88 },
      },
      subtitles: [
        {
          text: 'fallback caption',
          sourceStartSeconds: 1,
          durationSeconds: 1.4,
          position: 'bottom',
          type: 'subtitle',
        },
      ],
    },
    sourceDurationSeconds: 12,
  })

  const clips = tracksFor(edit).flatMap((track) => track.clips)
  assert.ok(clips.some((clip) => assetType(clip) === 'rich-caption'))
  assert.equal(
    clips.some((clip) => {
      const asset = clip.asset as Record<string, unknown> | undefined
      return asset?.type === 'text' && asset.text === 'fallback caption'
    }),
    false
  )
})
