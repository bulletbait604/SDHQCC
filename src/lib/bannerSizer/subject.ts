import { clamp, type FrameState, type Rect } from './placement'

export interface SubjectBox {
  /** Normalized to the source image, origin top-left. */
  x: number
  y: number
  width: number
  height: number
}

const FULL_SUBJECT: SubjectBox = { x: 0, y: 0, width: 1, height: 1 }

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

/**
 * Find a logo or other content that sits inside a large flat background.
 * A busy full-frame photo returns the whole image so framing matches Auto fit.
 */
export function detectSubject(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): SubjectBox {
  if (width < 2 || height < 2) return FULL_SUBJECT
  const channels = Math.max(3, Math.round(data.length / (width * height)))
  const margin = Math.max(1, Math.round(Math.min(width, height) * 0.08))
  const reds: number[] = []
  const greens: number[] = []
  const blues: number[] = []
  const at = (x: number, y: number) => {
    const index = (y * width + x) * channels
    return [data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0]
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const onEdge = x < margin || y < margin || x >= width - margin || y >= height - margin
      if (!onEdge) continue
      const [r, g, b] = at(x, y)
      reds.push(r)
      greens.push(g)
      blues.push(b)
    }
  }
  const background = [median(reds), median(greens), median(blues)]
  let deviation = 0
  for (let i = 0; i < reds.length; i++) {
    deviation += Math.abs(reds[i]! - background[0]!) + Math.abs(greens[i]! - background[1]!) + Math.abs(blues[i]! - background[2]!)
  }
  const threshold = Math.max(42, (deviation / Math.max(1, reds.length)) * 2.4)

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let count = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = at(x, y)
      const distance = Math.abs(r - background[0]!) + Math.abs(g - background[1]!) + Math.abs(b - background[2]!)
      if (distance < threshold) continue
      count += 1
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  const area = width * height
  if (count < area * 0.004 || maxX < minX) return FULL_SUBJECT
  const boxW = maxX - minX + 1
  const boxH = maxY - minY + 1
  if (boxW * boxH > area * 0.82) return FULL_SUBJECT

  const padX = Math.max(1, Math.round(boxW * 0.1))
  const padY = Math.max(1, Math.round(boxH * 0.1))
  const x0 = Math.max(0, minX - padX)
  const y0 = Math.max(0, minY - padY)
  const x1 = Math.min(width, maxX + 1 + padX)
  const y1 = Math.min(height, maxY + 1 + padY)
  return {
    x: x0 / width,
    y: y0 / height,
    width: (x1 - x0) / width,
    height: (y1 - y0) / height,
  }
}

/**
 * Cover the focus rectangle and, when the subject fits, zoom until the subject
 * fills that rectangle. A subject that is the whole photo stays at normal cover.
 */
export function frameAroundSubject(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  subject: SubjectBox,
  focus?: Rect
): FrameState {
  const safeFocus = focus && focus.width > 1 && focus.height > 1 ? focus : { x: 0, y: 0, width: dstW, height: dstH }
  const sw = Math.max(1, subject.width * srcW)
  const sh = Math.max(1, subject.height * srcH)
  const cx = (subject.x + subject.width / 2) * srcW
  const cy = (subject.y + subject.height / 2) * srcH
  const scaleCoverFocus = Math.max(safeFocus.width / srcW, safeFocus.height / srcH)
  const scaleContainSubject = Math.min(safeFocus.width / sw, safeFocus.height / sh)
  const scale = Math.min(Math.max(scaleCoverFocus, scaleContainSubject), scaleCoverFocus * 8)
  const base = Math.max(dstW / srcW, dstH / srcH)
  const zoom = clamp(scale / base, 0.2, 6)
  const dw = srcW * base * zoom
  const dh = srcH * base * zoom
  let dx = safeFocus.x + safeFocus.width / 2 - (cx / srcW) * dw
  let dy = safeFocus.y + safeFocus.height / 2 - (cy / srcH) * dh
  if (dw >= safeFocus.width) dx = clamp(dx, safeFocus.x + safeFocus.width - dw, safeFocus.x)
  if (dh >= safeFocus.height) dy = clamp(dy, safeFocus.y + safeFocus.height - dh, safeFocus.y)
  return {
    mode: 'subject',
    zoom,
    panX: (dx - (dstW - dw) / 2) / dstW,
    panY: (dy - (dstH - dh) / 2) / dstH,
  }
}
