import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import {
  ANIMATED_EMOTE_EXPORT,
  EMOTE_PRESETS,
  byteCapLabel,
  emoteExportFileName,
  emotePreset,
  fitsByteCap,
} from './presets'
import { buildEmotePrompt } from './prompt'
import { containZoom, emotePlacement } from './placement'
import { quantizeRgba } from './raster'
import { processGeneratedEmote, referenceForModel } from './process'

test('official emote sizes stay tied to the checked specs', () => {
  const kick = emotePreset('kick-emote')
  assert.ok(kick)
  assert.deepEqual(kick.outputs, [{ width: 500, height: 500 }])
  assert.equal(kick.maxBytes, 1024 * 1024)
  assert.equal(kick.byteCap, 'exclusive')
  assert.equal(kick.formats.includes('PNG'), true)

  const twitch = emotePreset('twitch-emote')
  assert.deepEqual(
    twitch?.outputs.map((output) => output.width),
    [112, 56, 28]
  )
  assert.equal(twitch?.maxBytes, 100 * 1024)
  assert.equal(twitch?.requiresTransparency, true)

  const youtube = emotePreset('youtube-emoji')
  assert.deepEqual(
    youtube?.outputs.map((output) => output.width),
    [480, 48]
  )
  assert.equal(youtube?.maxBytes, 1024 * 1024)

  const club = emotePreset('club-emote')
  assert.equal(club?.outputs[0]?.width, 500)
  assert.equal(club?.maxBytes, 512 * 1024)

  const discord = emotePreset('discord-emoji')
  assert.equal(discord?.outputs[0]?.width, 128)
  assert.equal(discord?.maxBytes, 256 * 1024)
  assert.equal(discord?.byteCap, 'exclusive')

  const sticker = emotePreset('discord-sticker')
  assert.equal(sticker?.outputs[0]?.width, 320)
  assert.equal(sticker?.outputs[0]?.height, 320)
  assert.equal(sticker?.maxBytes, 512 * 1024)

  const ffz = emotePreset('ffz-emote')
  assert.deepEqual(
    ffz?.outputs.map((output) => output.width),
    [128, 64, 32]
  )
  assert.equal(ffz?.maxBytes, null)

  const badge = emotePreset('twitch-badge')
  assert.equal(badge?.kind, 'badge')
  assert.deepEqual(
    badge?.outputs.map((output) => output.width),
    [72, 36, 18]
  )
  assert.equal(badge?.maxBytes, 25 * 1024)
  assert.equal(EMOTE_PRESETS.some((preset) => preset.id.includes('bttv') || preset.id.includes('7tv')), false)
  assert.equal(ANIMATED_EMOTE_EXPORT, false)
})

test('export filenames include the platform and pixel size', () => {
  const twitch = emotePreset('twitch-emote')!
  assert.equal(emoteExportFileName(twitch, twitch.outputs[0]!), 'twitch-emote-112x112.png')
  assert.equal(emoteExportFileName(twitch, twitch.outputs[2]!), 'twitch-emote-28x28.png')
  assert.equal(emoteExportFileName(emotePreset('kick-emote')!, { width: 500, height: 500 }), 'kick-emote-500x500.png')
  assert.equal(byteCapLabel(emotePreset('kick-emote')!), 'Under 1 MB')
  assert.equal(byteCapLabel(emotePreset('twitch-badge')!), 'Max 25 KB')
  assert.equal(byteCapLabel(emotePreset('ffz-emote')!), 'No file-size cap published')
  assert.equal(fitsByteCap(100 * 1024, emotePreset('twitch-emote')!), false)
  assert.equal(fitsByteCap(100 * 1024 - 1, emotePreset('twitch-emote')!), true)
  assert.equal(fitsByteCap(25 * 1024, emotePreset('twitch-badge')!), true)
})

test('the generate prompt keeps the reference as a guide and blocks copied characters', () => {
  const prompt = buildEmotePrompt({
    prompt: '  a happy frog with a tiny crown  ',
    style: 'sticker',
    transparent: true,
    hasReference: true,
  })
  assert.match(prompt, /happy frog with a tiny crown/)
  assert.match(prompt, /die-cut sticker/)
  assert.match(prompt, /#FF00FF/)
  assert.match(prompt, /do not reproduce it/i)
  assert.match(prompt, /trademarked or copyrighted character/)
  assert.throws(() => buildEmotePrompt({ prompt: '   ', style: 'chibi', transparent: true, hasReference: false }))
  assert.throws(() => buildEmotePrompt({ prompt: 'hello', style: 'oil', transparent: true, hasReference: false }))
})

test('square crop can tighten a wide photo and can show all of it', () => {
  const covered = emotePlacement(200, 100, 100, { zoom: 1, panX: 0, panY: 0 })
  assert.equal(covered.dw, 200)
  assert.equal(covered.dh, 100)
  assert.equal(covered.dx, -50)
  assert.equal(covered.dy, 0)
  const shown = emotePlacement(200, 100, 100, { zoom: containZoom(200, 100), panX: 0, panY: 0 })
  assert.equal(shown.dw, 100)
  assert.equal(shown.dh, 50)
})

test('posterize keeps clear pixels clear', () => {
  const pixels = Buffer.from([10, 10, 10, 0, 250, 10, 10, 255])
  quantizeRgba(pixels, 4)
  assert.equal(pixels[3], 0)
  assert.equal(pixels[7], 255)
  assert.equal(pixels[4]! > 200, true)
})

test('a magenta field is removed and the subject stays opaque', async () => {
  const width = 40
  const height = 40
  const raw = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const subject = x >= 12 && x < 28 && y >= 12 && y < 28
      raw[i] = subject ? 220 : 255
      raw[i + 1] = subject ? 32 : 0
      raw[i + 2] = subject ? 32 : 255
      raw[i + 3] = 255
    }
  }
  const source = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer()
  const processed = await processGeneratedEmote({ image: source, transparent: true, size: 64 })
  assert.equal(processed.backgroundRemoved, true)
  assert.equal(processed.width, 64)
  const { data, info } = await sharp(processed.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const corner = data[3]
  const center = data[((32 * info.width + 32) * 4) + 3]
  assert.equal(corner, 0)
  assert.equal((center ?? 0) > 200, true)
})

test('an opaque request keeps the background', async () => {
  const raw = Buffer.alloc(32 * 32 * 4, 255)
  const source = await sharp(raw, { raw: { width: 32, height: 32, channels: 4 } }).png().toBuffer()
  const processed = await processGeneratedEmote({ image: source, transparent: false, size: 32 })
  assert.equal(processed.backgroundRemoved, false)
  const { data } = await sharp(processed.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  assert.equal(data[3], 255)
})

test('a gif reference uses the first frame as a jpeg', async () => {
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
  const jpeg = await referenceForModel(gif)
  const meta = await sharp(jpeg).metadata()
  assert.equal(meta.format, 'jpeg')
  assert.equal(meta.width, 1)
  assert.equal(meta.pages, undefined)
})
