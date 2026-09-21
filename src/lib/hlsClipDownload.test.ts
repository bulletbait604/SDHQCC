import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isHlsSource,
  parseHlsPlaylist,
  pickHlsVariant,
} from './hlsClipDownload'

const PLAYLIST_URL = 'https://clips.kick.com/clips/49/clip_01ABC/playlist.m3u8'

test('isHlsSource detects Kick clip playlists', () => {
  assert.equal(isHlsSource(`${PLAYLIST_URL}`, 'application/octet-stream'), true)
  assert.equal(isHlsSource('https://cdn.example/clip.mp4', 'video/mp4'), false)
  assert.equal(isHlsSource('https://cdn.example/clip', 'application/octet-stream', '#EXTM3U\n#EXT-X-ENDLIST\n'), true)
})

test('parseHlsPlaylist reads Kick clip byte-range MPEG-TS segments', () => {
  const parsed = parseHlsPlaylist(
    `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-TARGETDURATION:5
#EXT-X-BYTERANGE:4441124@4538132
#EXTINF:4.167,
910.ts
#EXT-X-BYTERANGE:4263464@8979256
#EXTINF:4.167,
910.ts
#EXT-X-BYTERANGE:4328700@0
#EXTINF:4.166,
911.ts
#EXT-X-ENDLIST
`,
    PLAYLIST_URL
  )
  assert.equal(parsed.kind, 'media')
  if (parsed.kind !== 'media') return
  assert.equal(parsed.encrypted, false)
  assert.equal(parsed.segments.length, 3)
  assert.equal(parsed.segments[0]?.url, 'https://clips.kick.com/clips/49/clip_01ABC/910.ts')
  assert.deepEqual(parsed.segments[0]?.range, { start: 4538132, length: 4441124 })
  assert.deepEqual(parsed.segments[1]?.range, { start: 8979256, length: 4263464 })
  assert.deepEqual(parsed.segments[2]?.range, { start: 0, length: 4328700 })
})

test('parseHlsPlaylist continues omitted byte-range offsets on the same file', () => {
  const parsed = parseHlsPlaylist(
    `#EXTM3U
#EXT-X-BYTERANGE:100@50
#EXTINF:1,
a.ts
#EXT-X-BYTERANGE:20
#EXTINF:1,
a.ts
#EXT-X-ENDLIST
`,
    PLAYLIST_URL
  )
  assert.equal(parsed.kind, 'media')
  if (parsed.kind !== 'media') return
  assert.deepEqual(parsed.segments[1]?.range, { start: 150, length: 20 })
})

test('pickHlsVariant prefers 720p over a heavier 1080p rendition', () => {
  const picked = pickHlsVariant([
    { url: 'https://cdn.example/1080.m3u8', bandwidth: 5_000_000, height: 1080 },
    { url: 'https://cdn.example/720.m3u8', bandwidth: 2_500_000, height: 720 },
    { url: 'https://cdn.example/480.m3u8', bandwidth: 800_000, height: 480 },
  ])
  assert.equal(picked.url, 'https://cdn.example/720.m3u8')
})
