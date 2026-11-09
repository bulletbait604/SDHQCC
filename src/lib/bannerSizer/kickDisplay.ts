import type { Rect } from './placement'

/**
 * Kick's live channel CSS, checked 9 Nov 2026 in
 * https://assets.kick.com/main/_next/static/chunks/2szw8g9tyxqgs.css
 * and on kick.com channel pages. Kick Help does not publish these display sizes.
 */
export const KICK_MOBILE_BANNER_HEIGHT = 44
export const KICK_DESKTOP_BANNER_HEIGHT = 134
/** Content column at a 1920px-wide window with Kick's sidebar and chat open. */
export const KICK_DESKTOP_COLUMN_AT_1920 = 1324
/** Typical phone width for the 44px strip. The height is fixed; the width is the viewport. */
export const KICK_PHONE_WIDTH = 390

/**
 * Kick defines this token, but the offline header image does not use it as a height.
 * The stylesheet only emits it as a desktop margin utility.
 */
export const KICK_DESKTOP_REDUCED_BANNER_HEIGHT = 320

/**
 * Ended-stream image box measured on the Home tab at a 1920px window.
 * The image is in the DOM here and is not visible: the page goes from the
 * short header to the profile row.
 */
export const KICK_ENDED_STREAM_DESKTOP_BOX = { width: 1324, height: 880 }

/** Phone player area under the 44px strip is 56.25vw, which is 16:9. */
export const KICK_ENDED_STREAM_PHONE_ASPECT = 16 / 9

/**
 * Visible slice of an export when a slot uses object-fit: cover and object-position: center.
 * Returns a rect in export pixels.
 */
export function objectCoverWindow(exportW: number, exportH: number, slotW: number, slotH: number): Rect {
  const slotAspect = slotW / slotH
  const exportAspect = exportW / exportH
  if (exportAspect >= slotAspect) {
    const width = exportH * slotAspect
    return { x: (exportW - width) / 2, y: 0, width, height: exportH }
  }
  const height = exportW / slotAspect
  return { x: 0, y: (exportH - height) / 2, width: exportW, height }
}

export function kickHeaderDesktopWindow(exportW: number, exportH: number): Rect {
  return objectCoverWindow(exportW, exportH, KICK_DESKTOP_COLUMN_AT_1920, KICK_DESKTOP_BANNER_HEIGHT)
}

export function kickHeaderPhoneWindow(exportW: number, exportH: number): Rect {
  return objectCoverWindow(exportW, exportH, KICK_PHONE_WIDTH, KICK_MOBILE_BANNER_HEIGHT)
}
