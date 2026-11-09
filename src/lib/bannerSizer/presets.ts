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
    name: 'Kick channel banner',
    width: 1280,
    height: 700,
    sizeStatus: 'minimum',
    maxBytes: 4 * 1024 * 1024,
    maxBytesNote: 'Maximum file size 4 MB.',
    fileTypes: 'JPG, JPEG, PNG',
    fileTypesShort: 'JPG, JPEG, PNG',
    summary: 'Minimum 1280×700. Kick does not publish a maximum pixel size or a desktop/mobile crop.',
    displayNote:
      'Kick says this banner image is shown at the top of the channel page. No separate desktop or mobile crop is published, so the preview is the full 1280×700 frame.',
    sourceLabel: 'Kick Help — How to update your profile',
    sourceUrl: 'https://help.kick.com/en/articles/7120563-how-to-update-your-profile',
  },
  {
    id: 'kick-offline',
    group: 'streaming',
    name: 'Kick offline banner',
    width: 1920,
    height: 1080,
    sizeStatus: 'exact',
    maxBytes: 4 * 1024 * 1024,
    maxBytesNote: 'Maximum file size 4 MB.',
    fileTypes: 'JPG, JPEG, PNG',
    fileTypesShort: 'JPG, JPEG, PNG',
    summary: '1920×1080. Kick asks for a 1080p image when the stream has ended.',
    displayNote:
      'Kick specifies 1920×1080 for the channel offline banner and does not publish an extra crop. The preview is the full 16:9 frame.',
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
    id: 'club-profile',
    group: 'social',
    name: 'Club profile banner',
    width: 1134,
    height: 567,
    sizeStatus: 'estimated',
    maxBytes: 10 * 1024 * 1024,
    maxBytesNote: 'Maximum file size 10 MB. GIFs cannot be cropped on upload.',
    fileTypes: 'Image or GIF. Animated GIF export is not included; a still JPEG is exported instead.',
    fileTypesShort: 'Image or GIF',
    summary:
      'Club does not publish pixel dimensions. 1134×567 (2:1) is the background image currently served for club.com/bulletbait604.',
    displayNote:
      'Desktop and phone views of that public profile both showed the full 2:1 banner, with the avatar overlapping the lower-left. That overlap is measured from the live page, not from a Club size chart. Static images can be cropped in Club’s editor; GIFs cannot, so a GIF must already be the right size.',
    sourceLabel: 'Club docs — Updating your profile',
    sourceUrl: 'https://docs.club.com/general/understanding-your-account-management-tools/updating-your-profile',
  },
  {
    id: 'x-header',
    group: 'social',
    name: 'X header',
    width: 1500,
    height: 500,
    sizeStatus: 'recommended',
    maxBytes: 2 * 1024 * 1024,
    maxBytesNote:
      'X publishes a 2 MB maximum for profile photos in the upload-help article. A separate header cap is not stated, so exports stay under 2 MB.',
    fileTypes: 'JPEG, GIF, or PNG. Animated GIFs are not supported for the header.',
    fileTypesShort: 'JPEG, GIF, PNG',
    summary: 'Recommended header (banner) size 1500×500.',
    displayNote:
      'X publishes the recommended header size and does not publish a separate desktop or mobile crop. The preview is the full 1500×500 frame.',
    sourceLabel: 'X Help — How to customize your profile',
    sourceUrl: 'https://help.x.com/en/managing-your-account/how-to-customize-your-profile',
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
  {
    id: 'discord-server',
    group: 'social',
    name: 'Discord server banner',
    width: 960,
    height: 540,
    sizeStatus: 'recommended',
    maxBytes: null,
    maxBytesNote: 'Discord does not publish a file-size cap for server banners. Upload at least 960×540.',
    fileTypes: 'Image or GIF. Animated banners need Boosting Level 3. This tool exports a still JPEG.',
    fileTypesShort: 'Image or GIF',
    summary: 'Recommended 960×540 (16:9). A 1920×1080 upload is resized by Discord. Keep the top 48 px simple.',
    displayNote:
      'Discord says the top 48 px of the file should stay free of busy imagery so the server title stays readable. A separate phone crop is not published.',
    sourceLabel: 'Discord Support — Server Banners',
    sourceUrl: 'https://support.discord.com/hc/en-us/articles/360028716472-Server-Banners',
  },
  {
    id: 'discord-profile',
    group: 'social',
    name: 'Discord profile banner',
    width: 600,
    height: 240,
    sizeStatus: 'minimum',
    maxBytes: 10 * 1024 * 1024,
    maxBytesNote: 'PNG, JPG, and animated GIFs under 10 MB. Nitro is required to upload one.',
    fileTypes: 'PNG, JPG, GIF',
    fileTypesShort: 'PNG, JPG, GIF',
    summary: 'Recommended minimum 600×240.',
    displayNote:
      'Discord publishes the minimum size and file rules, not a desktop versus mobile crop. The preview is the full 600×240 frame. Animated GIF export is not included.',
    sourceLabel: 'Discord Support — Per-server profiles',
    sourceUrl: 'https://support.discord.com/hc/en-us/articles/4409388345495-Per-Server-Profiles',
  },
]

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
