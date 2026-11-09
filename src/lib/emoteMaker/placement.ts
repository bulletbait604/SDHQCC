export interface EmoteFrame {
  /** 1 covers the square. Higher zooms in. Lower shows more and leaves empty edges. */
  zoom: number
  panX: number
  panY: number
}

export interface EmotePlacement {
  dx: number
  dy: number
  dw: number
  dh: number
}

export function defaultEmoteFrame(): EmoteFrame {
  return { zoom: 1, panX: 0, panY: 0 }
}

/** Zoom that fits the whole image inside the square. 1 is the cover crop. */
export function containZoom(srcW: number, srcH: number): number {
  if (srcW <= 0 || srcH <= 0) return 1
  const wide = srcW / srcH
  const coverOverContain = wide >= 1 ? wide : 1 / wide
  return 1 / coverOverContain
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Cover-crop a source into a square. Pan is a fraction of the square, applied after centering. */
export function emotePlacement(srcW: number, srcH: number, dst: number, frame: EmoteFrame): EmotePlacement {
  if (srcW <= 0 || srcH <= 0 || dst <= 0) return { dx: 0, dy: 0, dw: 0, dh: 0 }
  const cover = Math.max(dst / srcW, dst / srcH)
  const zoom = Number.isFinite(frame.zoom) ? clamp(frame.zoom, 0.2, 6) : 1
  const dw = srcW * cover * zoom
  const dh = srcH * cover * zoom
  let dx = (dst - dw) / 2 + frame.panX * dst
  let dy = (dst - dh) / 2 + frame.panY * dst
  if (dw >= dst && dh >= dst) {
    dx = clamp(dx, dst - dw, 0)
    dy = clamp(dy, dst - dh, 0)
  }
  return { dx, dy, dw, dh }
}
