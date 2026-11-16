/**
 * Emote and badge presets from official help pages, checked 9 November 2026.
 * BetterTTV and 7TV are omitted: no official page confirmed a current size.
 * Animated GIF/APNG export is not offered. The Gemini image model returns one still.
 */

export type EmoteGroup = 'streaming' | 'chat' | 'badges'

export type ByteCap = 'exclusive' | 'inclusive'

export interface EmoteOutput {
  width: number
  height: number
}

export interface EmotePreset {
  id: string
  group: EmoteGroup
  /** Badge presets are not emotes. */
  kind: 'emote' | 'badge'
  name: string
  fileSlug: string
  outputs: EmoteOutput[]
  /** Formats the platform says it accepts. */
  formats: string
  maxBytes: number | null
  byteCap: ByteCap
  maxBytesNote: string
  /** Twitch emotes and subscriber badges require a transparent background. */
  requiresTransparency: boolean
  /** WebP is an official format, used only if a PNG cannot fit the cap. */
  allowsWebpFallback: boolean
  summary: string
  sourceLabel: string
  sourceUrl: string
  alsoSourceLabel?: string
  alsoSourceUrl?: string
}

export const ANIMATED_EMOTE_EXPORT = false

export const ANIMATION_NOTE =
  'Animated GIF and APNG export is not included. The Gemini image model used for thumbnails and Banner Sizer returns one still image, and this tool does not call another image API.'

export const OMITTED_EMOTE_PLATFORMS = [
  {
    name: 'Club, Discord, and FrankerFaceZ',
    reason: 'This tool only exports YouTube, Facebook, Twitch, and Kick.',
  },
  {
    name: 'Facebook Stars',
    reason:
      'Meta’s help pages do not publish a pixel size for a Stars emoji. Facebook is included as a 240×240 subscriber sticker, which Meta Business Help does specify.',
  },
] as const

export const EMOTE_PRESETS: EmotePreset[] = [
  {
    id: 'kick-emote',
    group: 'streaming',
    kind: 'emote',
    name: 'Kick emote',
    fileSlug: 'kick-emote',
    outputs: [{ width: 500, height: 500 }],
    formats: 'PNG or GIF',
    maxBytes: 1024 * 1024,
    byteCap: 'exclusive',
    maxBytesNote: 'Less than 1 MB. Channel and subscriber emotes use the same file rules.',
    requiresTransparency: false,
    allowsWebpFallback: false,
    summary:
      '500×500. Kick accepts PNG or GIF. This export is a still PNG because animated GIF export is not included.',
    sourceLabel: 'Kick Help — How to add or edit KICK emotes',
    sourceUrl: 'https://help.kick.com/en/articles/7113467-how-to-add-or-edit-kick-emotes',
  },
  {
    id: 'twitch-emote',
    group: 'streaming',
    kind: 'emote',
    name: 'Twitch emote',
    fileSlug: 'twitch-emote',
    outputs: [
      { width: 112, height: 112 },
      { width: 56, height: 56 },
      { width: 28, height: 28 },
    ],
    formats: 'Static PNG. Animated uploads are GIF.',
    maxBytes: 100 * 1024,
    byteCap: 'exclusive',
    maxBytesNote:
      'Manual mode: each of 28, 56, and 112 must be under 100 KB. Emote Formatting also says a static PNG cannot exceed 1 MB. Auto-resize accepts one square PNG from 112×112 to 4096×4096 under 1 MB.',
    requiresTransparency: true,
    allowsWebpFallback: false,
    summary:
      'Exports 112×112, 56×56, and 28×28 PNGs with a transparent background. Animated GIFs are limited to 60 frames: 1 MB in auto-resize, or 512 KB each in manual mode. Animated export is not included.',
    sourceLabel: 'Twitch Help — Emote Formatting',
    sourceUrl: 'https://help.twitch.tv/s/article/emote-guidelines',
    alsoSourceLabel: 'Twitch Help — Subscriber Emote Guide',
    alsoSourceUrl: 'https://help.twitch.tv/s/article/subscriber-emote-guide',
  },
  {
    id: 'youtube-emoji',
    group: 'streaming',
    kind: 'emote',
    name: 'YouTube member emoji',
    fileSlug: 'youtube-member-emoji',
    outputs: [
      { width: 480, height: 480 },
      { width: 48, height: 48 },
    ],
    formats: 'JPEG, PNG, or GIF',
    maxBytes: 1024 * 1024,
    byteCap: 'exclusive',
    maxBytesNote: 'Less than 1 MB. Preferred size is 48×48. Largest accepted size is 480×480.',
    requiresTransparency: false,
    allowsWebpFallback: false,
    summary:
      'Exports the preferred 48×48 and the largest 480×480 as static PNGs. YouTube shows a GIF as a still image, so an animation is not exported.',
    sourceLabel: 'YouTube Help — Channel memberships',
    sourceUrl: 'https://support.google.com/youtube/answer/7544492?hl=en',
  },
  {
    id: 'facebook-sticker',
    group: 'badges',
    kind: 'badge',
    name: 'Facebook subscriber sticker',
    fileSlug: 'facebook-subscriber-sticker',
    outputs: [{ width: 240, height: 240 }],
    formats: 'PNG with a transparent background',
    maxBytes: null,
    byteCap: 'inclusive',
    maxBytesNote:
      'Meta does not publish a file-size cap for this sticker. Desktop upload is PNG, transparent, exactly 240×240. This is not a chat emote and not a profile photo.',
    requiresTransparency: true,
    allowsWebpFallback: false,
    summary:
      'Subscriber sticker, not a chat emote. Meta Business Help says each file is a transparent PNG at 240×240. Facebook does not publish a Stars emoji size, and the Page profile photo is a separate 320×320 upload.',
    sourceLabel: 'Meta Business Help — Subscriber stickers',
    sourceUrl: 'https://www.facebook.com/business/help/767160797072449',
    alsoSourceLabel: 'Facebook Help — Page profile picture size',
    alsoSourceUrl: 'https://www.facebook.com/help/125379114252045',
  },
  {
    id: 'twitch-badge',
    group: 'badges',
    kind: 'badge',
    name: 'Twitch subscriber badge',
    fileSlug: 'twitch-subscriber-badge',
    outputs: [
      { width: 72, height: 72 },
      { width: 36, height: 36 },
      { width: 18, height: 18 },
    ],
    formats: 'PNG',
    maxBytes: 25 * 1024,
    byteCap: 'inclusive',
    maxBytesNote: 'PNG only, transparent background, and the file cannot exceed 25 KB. This is a badge, not an emote.',
    requiresTransparency: true,
    allowsWebpFallback: false,
    summary:
      'Badge, not an emote. Exports 72×72, 36×36, and 18×18 transparent PNGs. Each file is kept at or under 25 KB.',
    sourceLabel: 'Twitch Help — Subscriber Badge Guide',
    sourceUrl: 'https://help.twitch.tv/s/article/subscriber-badge-guide',
  },
]

const PRESET_BY_ID = new Map(EMOTE_PRESETS.map((preset) => [preset.id, preset]))

export function emotePreset(id: string): EmotePreset | undefined {
  return PRESET_BY_ID.get(id)
}

export function emotePresetsInGroup(group: EmoteGroup): EmotePreset[] {
  return EMOTE_PRESETS.filter((preset) => preset.group === group)
}

export function formatByteLimit(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024)
    return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`
  }
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export function byteCapLabel(preset: EmotePreset): string {
  if (preset.maxBytes == null) return 'No file-size cap published'
  const amount = formatByteLimit(preset.maxBytes)
  return preset.byteCap === 'exclusive' ? `Under ${amount}` : `Max ${amount}`
}

export function fitsByteCap(byteLength: number, preset: Pick<EmotePreset, 'maxBytes' | 'byteCap'>): boolean {
  if (preset.maxBytes == null) return true
  return preset.byteCap === 'exclusive' ? byteLength < preset.maxBytes : byteLength <= preset.maxBytes
}

export function outputSizeLabel(preset: EmotePreset): string {
  return preset.outputs.map((output) => `${output.width}×${output.height}`).join(', ')
}

export function emoteExportFileName(preset: EmotePreset, output: EmoteOutput, extension: 'png' | 'webp' = 'png'): string {
  return `${preset.fileSlug}-${output.width}x${output.height}.${extension}`
}
