import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { BANNER_PRESETS, bannerExportFileName, bannerPreset, defaultBannerSelected } from './presets'
import {
  defaultFrame,
  leftAlignedCoverWindow,
  placementFor,
  youtubeSafeRect,
} from './placement'
import { bannerWarnings, previewFrames } from './previewFrames'
import { encodeUnderCap } from './encodeUnderCap'
import { zipStore } from './zipStore'
import { compositeSubjectOverFill, visiblePlacement } from './aiComposite'

test('official banner sizes stay tied to the checked specs', () => {
  const kick = bannerPreset('kick-channel')
  assert.ok(kick)
  assert.equal(kick.width, 1280)
  assert.equal(kick.height, 700)
  assert.equal(kick.maxBytes, 4 * 1024 * 1024)
  assert.equal(kick.sizeStatus, 'minimum')

  const offline = bannerPreset('kick-offline')
  assert.equal(offline?.width, 1920)
  assert.equal(offline?.height, 1080)

  const twitch = bannerPreset('twitch-profile')
  assert.equal(twitch?.width, 1200)
  assert.equal(twitch?.height, 480)
  assert.equal(twitch?.maxBytes, 10 * 1024 * 1024)

  const player = bannerPreset('twitch-player')
  assert.equal(player?.sizeStatus, 'unpublished')
  assert.equal(player?.width, 1920)
  assert.equal(player?.height, 1080)

  const youtube = bannerPreset('youtube-channel')
  assert.equal(youtube?.width, 2560)
  assert.equal(youtube?.height, 1440)
  assert.equal(youtube?.maxBytes, 6 * 1024 * 1024)

  const club = bannerPreset('club-profile')
  assert.equal(club?.sizeStatus, 'estimated')
  assert.equal(club?.width, 1134)
  assert.equal(club?.height, 567)
  assert.equal(club?.maxBytes, 10 * 1024 * 1024)

  const x = bannerPreset('x-header')
  assert.equal(x?.width, 1500)
  assert.equal(x?.height, 500)

  const facebook = bannerPreset('facebook-page-cover')
  assert.equal(facebook?.width, 851)
  assert.equal(facebook?.height, 315)

  const discord = bannerPreset('discord-server')
  assert.equal(discord?.width, 960)
  assert.equal(discord?.height, 540)

  const profile = bannerPreset('discord-profile')
  assert.equal(profile?.width, 600)
  assert.equal(profile?.height, 240)
  assert.equal(BANNER_PRESETS.length, 10)
})

test('export filenames include the platform and pixel size', () => {
  assert.equal(bannerExportFileName(bannerPreset('kick-channel')!), 'kick-channel-banner-1280x700.jpg')
  assert.equal(bannerExportFileName(bannerPreset('x-header')!), 'x-header-1500x500.jpg')
})

test('YouTube safe area scales from 1235x338 at the minimum upload', () => {
  const safe = youtubeSafeRect(2560, 1440)
  assert.ok(Math.abs(safe.width - 1543.75) < 0.01)
  assert.ok(Math.abs(safe.height - 422.5) < 0.01)
  assert.ok(Math.abs(safe.x - 508.125) < 0.01)
  assert.ok(Math.abs(safe.y - 508.75) < 0.01)
  const frames = previewFrames(bannerPreset('youtube-channel')!)
  assert.deepEqual(frames.map((frame) => frame.id), ['tv', 'desktop', 'tablet', 'mobile'])
  assert.equal(frames[0]?.window, null)
  assert.match(frames[0]?.note || '', /does not publish/i)
})

test('Facebook cover windows stay left aligned at the published aspects', () => {
  const computer = leftAlignedCoverWindow(851, 315, 16 / 9)
  const mobile = leftAlignedCoverWindow(851, 315, 2.4)
  assert.equal(computer.x, 0)
  assert.equal(computer.width, 560)
  assert.equal(computer.height, 315)
  assert.equal(mobile.x, 0)
  assert.equal(mobile.width, 756)
  assert.equal(mobile.height, 315)
  const frames = previewFrames(bannerPreset('facebook-page-cover')!)
  assert.equal(frames[1]?.marks[0]?.rect.height, 40)
  assert.equal(frames[1]?.marks[0]?.rect.width, 196)
})

test('a generic photo auto-fits every selected platform without stretching', () => {
  const ids = ['kick-channel', 'twitch-profile', 'youtube-channel']
  assert.deepEqual(ids.filter((id) => defaultBannerSelected(id)), ids)
  for (const id of ids) {
    const preset = bannerPreset(id)!
    const frame = defaultFrame(1200, 800, preset.width, preset.height)
    assert.equal(frame.mode, 'crop')
    const placed = placementFor(1200, 800, preset.width, preset.height, frame)
    assert.equal(placed.coversFrame, true)
    assert.ok(Math.abs(placed.dw / placed.dh - 1200 / 800) < 0.01)
  }
  assert.equal(defaultBannerSelected('club-profile'), false)
})

test('crop mode covers the frame and fit mode does not stretch', () => {
  const crop = placementFor(1000, 1000, 1280, 700, { mode: 'crop', zoom: 1, panX: 0, panY: 0 })
  assert.equal(crop.coversFrame, true)
  assert.ok(Math.abs(crop.dw / crop.dh - 1) < 0.001)
  const fit = placementFor(1000, 1000, 1280, 700, { mode: 'fit', zoom: 1, panX: 0, panY: 0 })
  assert.equal(fit.coversFrame, false)
  assert.ok(Math.abs(fit.dw / fit.dh - 1) < 0.001)
  const stretch = placementFor(1000, 1000, 1280, 700, { mode: 'stretch', zoom: 1, panX: 0, panY: 0 })
  assert.equal(stretch.dw, 1280)
  assert.equal(stretch.dh, 700)
})

test('safe-area warning fires when the logo marker leaves the YouTube box', () => {
  const preset = bannerPreset('youtube-channel')!
  const frame = { mode: 'crop' as const, zoom: 1, panX: 0, panY: 0 }
  const placement = placementFor(2560, 1440, preset.width, preset.height, frame)
  const inside = bannerWarnings({ preset, frame, placement, logo: { x: 0.5, y: 0.5 } })
  assert.equal(inside.some((line) => /outside the YouTube safe area/.test(line)), false)
  const outside = bannerWarnings({ preset, frame, placement, logo: { x: 0.02, y: 0.02 } })
  assert.equal(outside.some((line) => /outside the YouTube safe area/.test(line)), true)
})

test('jpeg encoder stops once the file fits the cap', async () => {
  const encoded = await encodeUnderCap(async (quality) => {
    const size = quality > 0.5 ? 200 : 40
    return new Uint8Array(size)
  }, 100)
  assert.equal(encoded.withinCap, true)
  assert.equal(encoded.bytes.byteLength, 40)
})

test('zip store round-trips a jpeg name and payload', () => {
  const payload = new Uint8Array([1, 2, 3, 4, 255])
  const zip = zipStore([{ name: 'kick-channel-banner-1280x700.jpg', data: payload }], new Date('2026-01-02T03:04:05Z'))
  assert.equal(zip[0], 0x50)
  assert.equal(zip[1], 0x4b)
  const name = 'kick-channel-banner-1280x700.jpg'
  const nameAt = 30
  assert.equal(new TextDecoder().decode(zip.slice(nameAt, nameAt + name.length)), name)
  assert.deepEqual(zip.slice(nameAt + name.length, nameAt + name.length + payload.length), payload)
})

test('AI composite keeps the original subject pixels', async () => {
  const source = await sharp({
    create: { width: 20, height: 10, channels: 3, background: { r: 220, g: 10, b: 10 } },
  })
    .png()
    .toBuffer()
  const fill = await sharp({
    create: { width: 40, height: 20, channels: 3, background: { r: 10, g: 10, b: 220 } },
  })
    .png()
    .toBuffer()
  const visible = visiblePlacement(20, 10, 40, 20, { dx: 10, dy: 5, dw: 20, dh: 10 })
  assert.ok(visible)
  assert.equal(visible.destX, 10)
  const result = await compositeSubjectOverFill({
    source,
    fill,
    width: 40,
    height: 20,
    placed: { dx: 10, dy: 5, dw: 20, dh: 10 },
    maxBytes: 100_000,
  })
  const { data, info } = await sharp(result.jpeg).raw().toBuffer({ resolveWithObject: true })
  const pixel = (x: number, y: number) => {
    const index = (y * info.width + x) * info.channels
    return [data[index], data[index + 1], data[index + 2]]
  }
  const subject = pixel(20, 10)
  assert.ok(subject[0]! > 180 && subject[1]! < 40)
  const edge = pixel(1, 1)
  assert.ok(edge[2]! > 180 && edge[0]! < 40)
  assert.equal(info.width, 40)
  assert.equal(info.height, 20)
})
