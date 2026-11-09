import {
  KICK_ENDED_STREAM_DESKTOP_BOX,
  KICK_ENDED_STREAM_PHONE_ASPECT,
  kickHeaderDesktopWindow,
  kickHeaderPhoneWindow,
} from './kickDisplay'
import type { BannerPreset } from './presets'
import {
  leftAlignedCoverWindow,
  logoPoint,
  pointInRect,
  rectContains,
  youtubeSafeRect,
  type FrameState,
  type Placement,
  type Rect,
} from './placement'

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
  /**
   * crop clips the export to window.
   * contain letterboxes the whole export inside frameAspect.
   */
  presentation?: 'crop' | 'contain'
  /** Width / height of the on-screen box when presentation is contain. */
  frameAspect?: number
  blurredBackdrop?: boolean
}

export function previewFrames(preset: BannerPreset): PreviewFrame[] {
  const full = { x: 0, y: 0, width: preset.width, height: preset.height }

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

  if (preset.id === 'kick-channel') {
    const desktop = kickHeaderDesktopWindow(preset.width, preset.height)
    const phone = kickHeaderPhoneWindow(preset.width, preset.height)
    return [
      {
        id: 'desktop',
        label: 'Desktop header',
        note: '134px tall at lg, object-cover, centered. The 1324×134 box was measured at a 1920px-wide window. This crop is from Kick’s CSS, not from Kick Help. Export stays 1280×700.',
        window: desktop,
        marks: [],
      },
      {
        id: 'mobile',
        label: 'Phone header',
        note: '44px tall, full width, object-cover, centered. Shown here at a 390px-wide phone. Kick does not publish this height.',
        window: phone,
        marks: [],
      },
    ]
  }

  if (preset.id === 'kick-offline') {
    const desktopAspect = KICK_ENDED_STREAM_DESKTOP_BOX.width / KICK_ENDED_STREAM_DESKTOP_BOX.height
    return [
      {
        id: 'desktop-player',
        label: 'Desktop player',
        note: 'Object-contain in the measured 1324×880 player box, over a blurred cover. On the Home tab while offline this layer is covered by the profile row. It is not the short header.',
        window: null,
        marks: [],
        presentation: 'contain',
        frameAspect: desktopAspect,
        blurredBackdrop: true,
      },
      {
        id: 'phone-player',
        label: 'Phone player',
        note: 'Under the 44px header the phone player is 16:9, and object-contain shows this 1920×1080 file in full. The Home tab still covers it with the profile.',
        window: null,
        marks: [],
        presentation: 'contain',
        frameAspect: KICK_ENDED_STREAM_PHONE_ASPECT,
        blurredBackdrop: true,
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

/** Tightest crop window, used to keep a subject inside what viewers see. */
export function subjectFocusRect(preset: BannerPreset): Rect {
  const windows = previewFrames(preset)
    .filter((frame) => frame.presentation !== 'contain' && frame.window)
    .map((frame) => frame.window as Rect)
  if (windows.length === 0) return { x: 0, y: 0, width: preset.width, height: preset.height }
  return windows.reduce((tight, rect) => (rect.height < tight.height ? rect : tight))
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
    warnings.push('Stretch fills the frame by distorting the photo. Faces and logos can look wide or tall.')
  }
  if ((frame.mode === 'fit' || frame.mode === 'ai') && !placement.coversFrame) {
    warnings.push(
      frame.mode === 'ai'
        ? 'Empty edges are where AI fill paints. The original photo is placed without stretching.'
        : 'Fit keeps the whole photo and leaves empty edges. Nothing is cropped or stretched.'
    )
  }

  const point = logoPoint(placement, logo)
  const frames = previewFrames(preset)
  const focus = subjectFocusRect(preset)
  const hasCrop = frames.some((frame) => frame.presentation !== 'contain' && frame.window)
  if (hasCrop && !pointInRect(point.x, point.y, focus)) {
    warnings.push(`${preset.name}: the text/logo marker sits outside the area viewers see.`)
  }
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
  }
  return warnings
}

