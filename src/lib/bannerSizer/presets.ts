/**
 * Banner presets from official help pages, checked November 2026.
 * Crop behavior is only included when that page describes it.
 */

export type BannerGroup = 'streaming' | 'social'

export type SizeStatus = 'exact' | 'minimum' | 'recommended' | 'estimated' | 'unpublished'

export interface BannerPreset {
  id: string
  group: BannerGroup
  name: string
  /** Export width in pixels. */
  width: number
  /** Export height in pixels. */
  height: number
  sizeStatus: SizeStatus
  /** Hard or published file-size ceiling in bytes. Null when the platform does not publish one. */
  maxBytes: number | null
  maxBytesNote: string
  fileTypes: string
  /** Short label for the preset list. */
  fileTypesShort: string
  summary: string
  displayNote: string
  sourceLabel: string
  sourceUrl: string
}

export const BANNER_PRESETS: BannerPreset[] = [
  {
    id: 'kick-channel',
    group: 'streaming',
    name: 'Kick offline header',
    width: 1280,
    height: 700,
    sizeStatus: 'minimum',
    maxBytes: 4 * 1024 * 1024,
    maxBytesNote: 'Maximum file size 4 MB.',
    fileTypes: 'JPG, JPEG, PNG',
    fileTypesShort: 'JPG, JPEG, PNG',
    summary:
      'Upload at least 1280×700. Viewers see a short centered strip: 134px tall on desktop and 44px tall on a phone.',
    displayNote:
      'Kick’s help page says this banner is shown at the top of the channel when the stream is offline, and the minimum upload is 1280×700. It does not publish the on-screen crop. Measured in November 2026, the image is object-fit cover and object-position center inside a 134px desktop strip (844px wide at a 1440px window) and a 44px phone strip (390px wide). The file you download is still the full 1280×700. This is not the 1920×1080 ended-stream image.',
    sourceLabel: 'Kick Help — How to update your profile',
    sourceUrl: 'https://help.kick.com/en/articles/7120563-how-to-update-your-profile',
  },
  {
    id: 'kick-offline',
    group: 'streaming',
    name: 'Kick ended stream',
    width: 1920,
    height: 1080,
    sizeStatus: 'exact',
    maxBytes: 4 * 1024 * 1024,
    maxBytesNote: 'Maximum file size 4 MB.',
    fileTypes: 'JPG, JPEG, PNG',
    fileTypesShort: 'JPG, JPEG, PNG',
    summary: '1920×1080 image for the player after a stream ends. This is not the short offline header.',
    displayNote:
      'This is the ended-stream image, shown in the player with object-fit contain. Kick specifies 1920×1080 and does not publish an extra crop, so the preview is the full 16:9 frame. It is not the short offline header.',
    sourceLabel: 'Kick Help — How to update your profile',
    sourceUrl: 'https://help.kick.com/en/articles/7120563-how-to-update-your-profile',
  },
  {
    id: 'twitch-profile',
    group: 'streaming',
    name: 'Twitch profile banner',
    width: 1200,
    height: 480,
    sizeStatus: 'recommended',
    maxBytes: 10 * 1024 * 1024,
    maxBytesNote: 'Twitch account settings: profile banner maximum 10 MB.',
    fileTypes: 'GIF, JPG, PNG',
    fileTypesShort: 'GIF, JPG, PNG',
    summary: 'Recommended 1200×480. Height is scaled to 480 px. A wider browser window stretches the image.',
    displayNote:
      'Twitch scales any other height to 480 px and stretches the banner if the browser is wider than the image. Graphics should sit toward the left. A separate mobile crop size is not published.',
    sourceLabel: 'Twitch Help — Channel Page Setup',
    sourceUrl: 'https://help.twitch.tv/s/article/channel-page-setup',
  },
  {
    id: 'twitch-player',
    group: 'streaming',
    name: 'Twitch offline / player image',
    width: 1920,
    height: 1080,
    sizeStatus: 'unpublished',
    maxBytes: null,
    maxBytesNote:
      'Twitch does not publish a file-size cap for the video player banner. Profile pictures on the same page are capped at 10 MB.',
    fileTypes: 'Still image. Animated player banners are not supported.',
    fileTypesShort: 'Still image',
    summary:
      'Shown in the player when the channel is offline. Twitch does not publish pixel dimensions; 1920×1080 is the standard 16:9 player frame used here.',
    displayNote:
      'Channel Page Setup says this image appears when the channel is offline and that animated video player banners are not supported. It does not publish a crop or a pixel size, so this preview is the full 16:9 frame and is not a documented Twitch crop.',
    sourceLabel: 'Twitch Help — Channel Page Setup',
    sourceUrl: 'https://help.twitch.tv/s/article/channel-page-setup',
  },
  {
    id: 'youtube-channel',
    group: 'social',
    name: 'YouTube channel banner',
    width: 2560,
    height: 1440,
    sizeStatus: 'recommended',
    maxBytes: 6 * 1024 * 1024,
    maxBytesNote: 'File size 6 MB or smaller.',
    fileTypes:
      'Not listed for banners. Profile pictures on the same page must be JPG, GIF, BMP, or PNG, with no animated GIFs. This tool exports JPEG.',
    fileTypesShort: 'JPEG export',
    summary:
      'Recommended 2560×1440, especially for TV. Minimum upload 2048×1152 (16:9). Text/logo safe area at that minimum is 1235×338.',
    displayNote:
      'YouTube uses one banner on computer, mobile, and TV, and says it shows differently on each. The help page does not publish separate pixel crops for those devices. The marked box is the official safe area, scaled from 1235×338 on the 2048×1152 minimum onto this 2560×1440 file. It is centered because the leftover margin is nearly equal on every side (about 406–407 px at the minimum size).',
    sourceLabel: 'YouTube Help — Manage your channel branding',
    sourceUrl: 'https://support.google.com/youtube/answer/10456525',
  },
  {
    id: 'facebook-page-cover',
    group: 'social',
    name: 'Facebook Page cover',
    width: 851,
    height: 315,
    sizeStatus: 'recommended',
    maxBytes: 100 * 1024,
    maxBytesNote:
      'Facebook says the cover loads fastest as an sRGB JPG under 100 KB. That is a speed guide, not a stated rejection limit. Minimum size is 400×150.',
    fileTypes: 'sRGB JPG is the published fast-loading format. PNG is suggested when the cover has a logo or text.',
    fileTypesShort: 'sRGB JPG',
    summary:
      'Fastest published size 851×315. Computer display is 16:9 and left-aligned. Mobile display is 2.4:1 and left-aligned.',
    displayNote:
      'The left side is partly covered by the Page profile picture. On a phone the picture overlaps the cover by about 40 px and the picture itself displays at 196×196. Facebook does not publish a computer overlap in pixels.',
    sourceLabel: 'Facebook Help — Page profile picture and cover photo dimensions',
    sourceUrl: 'https://www.facebook.com/help/125379114252045',
  },
]

/** One banner from each supported platform starts selected. */
export const DEFAULT_BANNER_SELECTION = [
  'kick-channel',
  'twitch-profile',
  'youtube-channel',
  'facebook-page-cover',
] as const

export function defaultBannerSelected(id: string): boolean {
  return (DEFAULT_BANNER_SELECTION as readonly string[]).includes(id)
}

const PRESET_BY_ID = new Map(BANNER_PRESETS.map((preset) => [preset.id, preset]))

export function bannerPreset(id: string): BannerPreset | undefined {
  return PRESET_BY_ID.get(id)
}

export function bannerPresetsInGroup(group: BannerGroup): BannerPreset[] {
  return BANNER_PRESETS.filter((preset) => preset.group === group)
}

export function formatByteLimit(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024)
    return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`
  }
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export function sizeStatusLabel(status: SizeStatus): string {
  switch (status) {
    case 'exact':
      return 'Exact size'
    case 'minimum':
      return 'Minimum size'
    case 'recommended':
      return 'Recommended size'
    case 'estimated':
      return 'Estimated size'
    case 'unpublished':
      return 'Size not published'
  }
}

export function bannerExportFileName(preset: BannerPreset): string {
  const slug = preset.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug}-${preset.width}x${preset.height}.jpg`
}
