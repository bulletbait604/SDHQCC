export type BannerMode = 'crop' | 'fit' | 'stretch' | 'ai'

export interface FrameState {
  mode: BannerMode
  /** 1 is the mode's default cover or contain scale. */
  zoom: number
  /** Pan as a fraction of the destination width/height, added after centering. */
  panX: number
  panY: number
}

export interface Placement {
  dx: number
  dy: number
  dw: number
  dh: number
  coversFrame: boolean
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export const DEFAULT_ZOOM = 1

/**
 * A new upload fills every banner immediately.
 * Cover keeps the photo's proportions. It does not letterbox or stretch.
 */
export function defaultFrame(
  _srcW?: number,
  _srcH?: number,
  _dstW?: number,
  _dstH?: number
): FrameState {
  return {
    mode: 'crop',
    zoom: DEFAULT_ZOOM,
    panX: 0,
    panY: 0,
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function placementFor(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  frame: FrameState
): Placement {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    return { dx: 0, dy: 0, dw: 0, dh: 0, coversFrame: false }
  }
  if (frame.mode === 'stretch') {
    return { dx: 0, dy: 0, dw: dstW, dh: dstH, coversFrame: true }
  }

  const cover = Math.max(dstW / srcW, dstH / srcH)
  const contain = Math.min(dstW / srcW, dstH / srcH)
  const base = frame.mode === 'crop' ? cover : contain
  const zoom = Number.isFinite(frame.zoom) ? clamp(frame.zoom, 0.2, 6) : 1
  const dw = srcW * base * zoom
  const dh = srcH * base * zoom
  let dx = (dstW - dw) / 2 + frame.panX * dstW
  let dy = (dstH - dh) / 2 + frame.panY * dstH

  if (frame.mode === 'crop' && dw >= dstW && dh >= dstH) {
    dx = clamp(dx, dstW - dw, 0)
    dy = clamp(dy, dstH - dh, 0)
  }

  const coversFrame = dx <= 0.5 && dy <= 0.5 && dx + dw >= dstW - 0.5 && dy + dh >= dstH - 0.5
  return { dx, dy, dw, dh, coversFrame }
}

export function rectContains(outer: Rect, inner: Rect, epsilon = 0.75): boolean {
  return (
    inner.x >= outer.x - epsilon &&
    inner.y >= outer.y - epsilon &&
    inner.x + inner.width <= outer.x + outer.width + epsilon &&
    inner.y + inner.height <= outer.y + outer.height + epsilon
  )
}

export function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.width && y <= rect.y + rect.height
}

export function logoPoint(
  placement: Placement,
  logo: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: placement.dx + clamp(logo.x, 0, 1) * placement.dw,
    y: placement.dy + clamp(logo.y, 0, 1) * placement.dh,
  }
}

/** YouTube's published safe area is 1235×338 at the 2048×1152 minimum upload. */
export function youtubeSafeRect(width: number, height: number): Rect {
  const basisW = 2048
  const basisH = 1152
  const safeW = 1235 * (width / basisW)
  const safeH = 338 * (height / basisH)
  return {
    x: (width - safeW) / 2,
    y: (height - safeH) / 2,
    width: safeW,
    height: safeH,
  }
}

/**
 * Facebook's cover is left-aligned and full-bleed.
 * Computer aspect is 16:9. Mobile aspect is 2.4:1.
 * Both are taken from the 851×315 file by keeping the left edge.
 */
export function leftAlignedCoverWindow(
  fileW: number,
  fileH: number,
  targetRatio: number
): Rect {
  const fileRatio = fileW / fileH
  if (fileRatio >= targetRatio) {
    const visibleW = fileH * targetRatio
    return { x: 0, y: 0, width: visibleW, height: fileH }
  }
  const visibleH = fileW / targetRatio
  return { x: 0, y: 0, width: fileW, height: visibleH }
}
