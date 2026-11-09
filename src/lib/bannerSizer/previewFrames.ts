import type { BannerPreset } from './presets'
import {
  leftAlignedCoverWindow,
  logoPoint,
  objectCoverWindow,
  pointInRect,
  rectContains,
  youtubeSafeRect,
  type FrameState,
  type Placement,
  type Rect,
} from './placement'

/**
 * Kick offline header display boxes, measured on kick.com in November 2026.
 * The channel banner image uses object-fit: cover and object-position: center.
 * Heights come from --channel-desktop-banner-height (134px) and
 * --channel-mobile-banner-height (44px).
 * Desktop width is the channel column at a 1440px window (844px, after the
 * 256px sidebar and 340px chat). Phone width is a 390px viewport, full bleed.
 * The downloaded file is still the 1280×700 minimum. This is not the 1920×1080 ended-stream image.
 */
export const KICK_OFFLINE_HEADER_DESKTOP = { width: 844, height: 134 }
export const KICK_OFFLINE_HEADER_PHONE = { width: 390, height: 44 }

export interface PreviewMark {
  id: string
  label: string
  rect: Rect
  tone: 'safe' | 'danger'
}

export interface PreviewFrame {
  id: string
  label: string
  note: string
  /** Visible region of the export. The whole file when null. */
  window: Rect | null
  marks: PreviewMark[]
}

export function previewFrames(preset: BannerPreset): PreviewFrame[] {
  const full = { x: 0, y: 0, width: preset.width, height: preset.height }

  if (preset.id === 'kick-channel') {
    const desktop = objectCoverWindow(
      preset.width,
      preset.height,
      KICK_OFFLINE_HEADER_DESKTOP.width,
      KICK_OFFLINE_HEADER_DESKTOP.height
    )
    const phone = objectCoverWindow(
      preset.width,
      preset.height,
      KICK_OFFLINE_HEADER_PHONE.width,
      KICK_OFFLINE_HEADER_PHONE.height
    )
    return [
      {
        id: 'desktop',
        label: 'Desktop',
        note: 'Kick shows the 1280×700 offline header as a 134px-tall strip. At a 1440px window that strip is 844×134, object-fit cover, centered. The download is still the full file.',
        window: desktop,
        marks: [],
      },
      {
        id: 'phone',
        label: 'Phone',
        note: 'On a 390px-wide phone the same file is a 44px-tall strip across the screen, object-fit cover, centered. This is the offline header, not the 1920×1080 ended-stream image.',
        window: phone,
        marks: [],
      },
    ]
  }

  if (preset.id === 'youtube-channel') {
    const safe = youtubeSafeRect(preset.width, preset.height)
    const mark: PreviewMark = {
      id: 'safe',
      label: 'Text and logo safe area',
      rect: safe,
      tone: 'safe',
    }
    const note =
      'Same file on every device. YouTube does not publish the TV, desktop, tablet, or mobile crop rectangles, so each preview shows the full banner with the official safe area. It is not a guessed device crop.'
    return [
      { id: 'tv', label: 'TV', note, window: null, marks: [mark] },
      { id: 'desktop', label: 'Desktop', note, window: null, marks: [mark] },
      { id: 'tablet', label: 'Tablet', note, window: null, marks: [mark] },
      { id: 'mobile', label: 'Mobile', note, window: null, marks: [mark] },
    ]
  }

  if (preset.id === 'facebook-page-cover') {
    const computer = leftAlignedCoverWindow(preset.width, preset.height, 16 / 9)
    const mobile = leftAlignedCoverWindow(preset.width, preset.height, 2.4)
    return [
      {
        id: 'computer',
        label: 'Computer',
        note: 'Left-aligned full bleed at 16:9. The left side is partly covered by the profile picture. Facebook does not publish that overlap in pixels.',
        window: computer,
        marks: [],
      },
      {
        id: 'mobile',
        label: 'Mobile',
        note: 'Left-aligned full bleed at 2.4:1. The phone profile picture displays at 196×196 and overlaps the cover by about 40 px.',
        window: mobile,
        marks: [
          {
            id: 'avatar',
            label: 'Profile overlap, about 40 px',
            rect: {
              x: mobile.x,
              y: mobile.y + mobile.height - 40,
              width: Math.min(196, mobile.width),
              height: Math.min(40, mobile.height),
            },
            tone: 'danger',
          },
        ],
      },
    ]
  }

  if (preset.id === 'discord-server') {
    return [
      {
        id: 'banner',
        label: 'Server list',
        note: preset.displayNote,
        window: null,
        marks: [
          {
            id: 'title-band',
            label: 'Keep the top 48 px simple',
            rect: { x: 0, y: 0, width: preset.width, height: 48 },
            tone: 'danger',
          },
        ],
      },
    ]
  }

  if (preset.id === 'club-profile') {
    const avatar = Math.round(preset.height * 0.55)
    return [
      {
        id: 'desktop',
        label: 'Desktop',
        note: preset.displayNote,
        window: null,
        marks: [
          {
            id: 'avatar',
            label: 'Avatar overlap seen on the live profile',
            rect: {
              x: Math.round(preset.width * 0.04),
              y: preset.height - Math.round(avatar * 0.42),
              width: avatar,
              height: Math.round(avatar * 0.42),
            },
            tone: 'danger',
          },
        ],
      },
      {
        id: 'mobile',
        label: 'Mobile',
        note: 'The phone view of club.com/bulletbait604 also showed the full 2:1 banner, with the same lower-left avatar overlap. Club does not publish a separate mobile crop.',
        window: null,
        marks: [
          {
            id: 'avatar',
            label: 'Avatar overlap seen on the live profile',
            rect: {
              x: Math.round(preset.width * 0.04),
              y: preset.height - Math.round(avatar * 0.42),
              width: avatar,
              height: Math.round(avatar * 0.42),
            },
            tone: 'danger',
          },
        ],
      },
    ]
  }

  if (preset.id === 'twitch-profile') {
    return [
      {
        id: 'banner',
        label: 'Channel header',
        note: preset.displayNote,
        window: full.width ? null : null,
        marks: [],
      },
    ]
  }

  return [
    {
      id: 'banner',
      label: 'Banner',
      note: preset.displayNote,
      window: null,
      marks: [],
    },
  ]
}

export function bannerWarnings(input: {
  preset: BannerPreset
  frame: FrameState
  placement: Placement
  logo: { x: number; y: number }
}): string[] {
  const warnings: string[] = []
  const { preset, frame, placement, logo } = input
  if (frame.mode === 'stretch') {
    warnings.push('Stretch fills the official size by distorting the photo. Faces and logos can look wide or tall.')
  }
  if (frame.mode === 'ai' && !placement.coversFrame) {
    warnings.push('Empty edges are where AI fill paints. The original photo stays in proportion until you generate it.')
  }

  const point = logoPoint(placement, logo)
  const frames = previewFrames(preset)
  const seen = new Set<string>()
  for (const frameView of frames) {
    for (const mark of frameView.marks) {
      if (seen.has(mark.id + mark.tone)) continue
      if (mark.tone === 'safe') {
        seen.add(mark.id + mark.tone)
        const imageRect: Rect = {
          x: placement.dx,
          y: placement.dy,
          width: placement.dw,
          height: placement.dh,
        }
        if (!rectContains(imageRect, mark.rect)) {
          warnings.push(
            `${preset.name}: part of the text/logo safe area is outside your photo. Devices can crop everything outside that box.`
          )
        }
        if (!pointInRect(point.x, point.y, mark.rect)) {
          warnings.push('The text/logo marker sits outside the YouTube safe area. Drag the marker onto your logo to check it.')
        }
      }
      if (mark.tone === 'danger' && pointInRect(point.x, point.y, mark.rect)) {
        seen.add(mark.id + mark.tone)
        warnings.push(`The text/logo marker is inside “${mark.label}”. Move it if that artwork has to stay readable.`)
      }
    }
    if (frameView.window && !pointInRect(point.x, point.y, frameView.window)) {
      const key = `outside:${frameView.id}`
      if (!seen.has(key)) {
        seen.add(key)
        warnings.push(
          `The text/logo marker sits outside the ${frameView.label.toLowerCase()} view of ${preset.name}. Drag the preview so it stays in that strip.`
        )
      }
    }
  }
  return warnings
}

