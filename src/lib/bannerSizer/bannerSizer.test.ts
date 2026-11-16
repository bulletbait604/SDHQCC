import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { BANNER_PRESETS, bannerExportFileName, bannerPreset, defaultBannerSelected } from './presets'
import {
  BANNER_ADJUSTMENTS,
  defaultFrame,
  leftAlignedCoverWindow,
  objectCoverWindow,
  placementFor,
  youtubeSafeRect,
} from './placement'
import { bannerWarnings, previewFrames, KICK_OFFLINE_HEADER_DESKTOP, KICK_OFFLINE_HEADER_PHONE } from './previewFrames'
import { buildFillPrompt, sanitizeBannerPrompt, BANNER_PROMPT_MAX } from './fillPrompt'
import { KICK_DESKTOP_REDUCED_BANNER_HEIGHT } from './kickDisplay'
import { detectSubject } from './subject'
import { buildBannerAiInstruction, cleanBannerPrompt } from './aiPrompt'
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

  const facebook = bannerPreset('facebook-page-cover')
  assert.equal(facebook?.width, 851)
  assert.equal(facebook?.height, 315)

  assert.equal(bannerPreset('club-profile'), undefined)
  assert.equal(bannerPreset('x-header'), undefined)
  assert.equal(bannerPreset('discord-server'), undefined)
  assert.equal(BANNER_PRESETS.length, 6)
  assert.deepEqual(
    BANNER_PRESETS.map((preset) => preset.id),
    ['kick-channel', 'kick-offline', 'twitch-profile', 'twitch-player', 'youtube-channel', 'facebook-page-cover']
  )
})

test('export filenames include the platform and pixel size', () => {
  assert.equal(bannerExportFileName(bannerPreset('kick-channel')!), 'kick-offline-header-1280x700.jpg')
  assert.equal(bannerExportFileName(bannerPreset('kick-offline')!), 'kick-ended-stream-1920x1080.jpg')
  assert.equal(bannerExportFileName(bannerPreset('facebook-page-cover')!), 'facebook-page-cover-851x315.jpg')
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

test('adjustment choices are only crop, AI fill, and stretch, and crop is the default', () => {
  assert.deepEqual([...BANNER_ADJUSTMENTS], ['crop', 'ai', 'stretch'])
  assert.equal(defaultFrame().mode, 'crop')
})

test('a generic photo crops into every selected platform without stretching', () => {
  const ids = ['kick-channel', 'twitch-profile', 'youtube-channel', 'facebook-page-cover']
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
  assert.equal(defaultBannerSelected('twitch-player'), false)
})

test('crop covers the frame, AI fill keeps proportions, and stretch fills the official size', () => {
  const crop = placementFor(1000, 1000, 1280, 700, { mode: 'crop', zoom: 1, panX: 0, panY: 0 })
  assert.equal(crop.coversFrame, true)
  assert.ok(Math.abs(crop.dw / crop.dh - 1) < 0.001)
  const ai = placementFor(1000, 1000, 1280, 700, { mode: 'ai', zoom: 1, panX: 0, panY: 0 })
  assert.equal(ai.coversFrame, false)
  assert.ok(Math.abs(ai.dw / ai.dh - 1) < 0.001)
  assert.ok(ai.dw < 1280)
  const stretch = placementFor(1000, 1000, 1280, 700, { mode: 'stretch', zoom: 1, panX: 0, panY: 0 })
  assert.equal(stretch.dw, 1280)
  assert.equal(stretch.dh, 700)
  assert.equal(stretch.coversFrame, true)
})

test('Kick offline header preview is the short centered strip, not the full upload or the ended stream', () => {
  assert.equal(KICK_OFFLINE_HEADER_DESKTOP.height, 134)
  assert.equal(KICK_OFFLINE_HEADER_DESKTOP.width, 844)
  assert.equal(KICK_OFFLINE_HEADER_PHONE.height, 44)
  assert.equal(KICK_OFFLINE_HEADER_PHONE.width, 390)

  const header = bannerPreset('kick-channel')!
  const frames = previewFrames(header)
  assert.deepEqual(frames.map((frame) => frame.id), ['desktop', 'phone'])
  const desktop = frames[0]!.window!
  const phone = frames[1]!.window!
  assert.deepEqual(desktop, objectCoverWindow(1280, 700, 844, 134))
  assert.deepEqual(phone, objectCoverWindow(1280, 700, 390, 44))
  assert.ok(Math.abs(desktop.width - 1280) < 0.01)
  assert.ok(desktop.height < 250)
  assert.ok(desktop.height > 180)
  assert.ok(Math.abs(desktop.y - (700 - desktop.height) / 2) < 0.01)
  assert.ok(phone.height < desktop.height)
  assert.ok(phone.height > 120)
  assert.match(frames[1]?.note || '', /44px/)
  assert.match(frames[0]?.note || '', /134px/)

  const ended = bannerPreset('kick-offline')!
  assert.equal(ended.width, 1920)
  assert.equal(ended.height, 1080)
  assert.equal(previewFrames(ended)[0]?.window, null)
  assert.match(ended.displayNote, /not the short offline header/i)
})

test('a centered logo stays inside the Kick header strip and an edge logo does not', () => {
  const preset = bannerPreset('kick-channel')!
  const frame = defaultFrame(1200, 1200, preset.width, preset.height)
  const placement = placementFor(1200, 1200, preset.width, preset.height, frame)
  const centered = bannerWarnings({ preset, frame, placement, logo: { x: 0.5, y: 0.5 } })
  assert.equal(centered.some((line) => /outside the desktop view/.test(line)), false)
  assert.equal(centered.some((line) => /outside the phone view/.test(line)), false)
  const edge = bannerWarnings({ preset, frame, placement, logo: { x: 0.5, y: 0.02 } })
  assert.equal(edge.some((line) => /outside the desktop view of Kick offline header/.test(line)), true)
  assert.equal(edge.some((line) => /outside the phone view of Kick offline header/.test(line)), true)
})

test('the edit prompt is included in AI fill and stays a bounded single line', () => {
  const prompt = buildFillPrompt(1280, 700, '  neon city edges \n keep the logo ')
  assert.match(prompt, /1280 by 700/)
  assert.match(prompt, /neon city edges keep the logo/)
  assert.match(prompt, /Do not move, crop, stretch, or redraw/)
  const empty = buildFillPrompt(1200, 480, '   ')
  assert.match(empty, /Continue the existing scene naturally/)
  assert.equal(sanitizeBannerPrompt('x'.repeat(800)).length, BANNER_PROMPT_MAX)
  assert.equal(sanitizeBannerPrompt(12), '')
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

test('Kick header preview does not use the 320px margin token as the strip height', () => {
  assert.equal(KICK_DESKTOP_REDUCED_BANNER_HEIGHT, 320)
  const frames = previewFrames(bannerPreset('kick-channel')!)
  assert.equal(
    frames.some((frame) => frame.window && Math.abs(frame.window.height - 320) < 1),
    false
  )
  assert.ok((frames[0]?.window?.height || 0) < 250)
  assert.ok((frames[1]?.window?.height || 0) < (frames[0]?.window?.height || 0))
})

test('Kick ended-stream preview contains the 1920x1080 file instead of pretending it is the header', () => {
  const preset = bannerPreset('kick-offline')!
  assert.equal(preset.width, 1920)
  assert.equal(preset.height, 1080)
  const frames = previewFrames(preset)
  assert.equal(frames.length, 2)
  assert.equal(frames[0]?.presentation, 'contain')
  assert.equal(frames[0]?.window, null)
  assert.ok(Math.abs((frames[0]?.frameAspect || 0) - 1324 / 880) < 0.001)
  assert.equal(frames[1]?.presentation, 'contain')
  assert.ok(Math.abs((frames[1]?.frameAspect || 0) - 16 / 9) < 0.001)
  assert.match(frames[0]?.note || '', /not the short header/i)
  assert.match(preset.summary, /not the short offline header/i)
})

test('YouTube and Twitch preview frames stay on their own rules', () => {
  const youtube = previewFrames(bannerPreset('youtube-channel')!)
  assert.deepEqual(youtube.map((frame) => frame.id), ['tv', 'desktop', 'tablet', 'mobile'])
  assert.equal(youtube[0]?.window, null)
  const twitch = previewFrames(bannerPreset('twitch-profile')!)
  assert.equal(twitch.length, 1)
  assert.equal(twitch[0]?.window, null)
  assert.equal(twitch[0]?.presentation, undefined)
})

test('subject detection frames a centered logo and ignores a full-bleed photo', () => {
  const width = 80
  const height = 60
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 240
    data[i + 1] = 240
    data[i + 2] = 240
    data[i + 3] = 255
  }
  for (let y = 22; y < 38; y++) {
    for (let x = 32; x < 48; x++) {
      const index = (y * width + x) * 4
      data[index] = 220
      data[index + 1] = 20
      data[index + 2] = 20
    }
  }
  const box = detectSubject(data, width, height)
  assert.ok(box.x > 0.2 && box.x < 0.45)
  assert.ok(box.y > 0.15 && box.y < 0.45)
  assert.ok(box.width < 0.5 && box.height < 0.6)
  assert.ok(box.x + box.width / 2 > 0.4 && box.x + box.width / 2 < 0.6)

  const flat = new Uint8Array(40 * 30 * 4)
  for (let i = 0; i < flat.length; i += 4) {
    flat[i] = (i / 4) % 40
    flat[i + 1] = 80
    flat[i + 2] = 120
    flat[i + 3] = 255
  }
  const whole = detectSubject(flat, 40, 30)
  assert.equal(whole.width, 1)
  assert.equal(whole.height, 1)
})

test('subject framing is not one of the banner adjustments', () => {
  assert.equal((BANNER_ADJUSTMENTS as readonly string[]).includes('subject'), false)
  assert.equal(defaultFrame().mode, 'crop')
})

test('an edit prompt changes the Gemini instruction and a blank prompt only fills edges', () => {
  const fill = buildBannerAiInstruction({ userPrompt: '   ', width: 1280, height: 700 })
  assert.equal(fill.keepsOriginalSubject, true)
  assert.match(fill.text, /Paint only the flat empty margins/)
  const edit = buildBannerAiInstruction({
    userPrompt: 'Darken the background and keep the logo sharp',
    width: 640,
    height: 134,
  })
  assert.equal(edit.keepsOriginalSubject, false)
  assert.match(edit.text, /Darken the background and keep the logo sharp/)
  assert.match(edit.text, /640 by 134/)
  assert.equal(cleanBannerPrompt('a'.repeat(500)).length, 400)
  assert.equal(cleanBannerPrompt(12), '')
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
