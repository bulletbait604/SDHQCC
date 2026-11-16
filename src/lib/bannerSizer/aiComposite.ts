import sharp from 'sharp'
import { encodeUnderCap } from './encodeUnderCap'

export interface PlacedRect {
  dx: number
  dy: number
  dw: number
  dh: number
}

const MODEL_LONG_EDGE = 1024

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Region of the source that is visible inside the banner, in source and destination pixels. */
export function visiblePlacement(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  placed: PlacedRect
): {
  srcX: number
  srcY: number
  srcW: number
  srcH: number
  destX: number
  destY: number
  destW: number
  destH: number
} | null {
  if (placed.dw < 1 || placed.dh < 1 || srcW < 1 || srcH < 1) return null
  const x0 = Math.max(0, placed.dx)
  const y0 = Math.max(0, placed.dy)
  const x1 = Math.min(dstW, placed.dx + placed.dw)
  const y1 = Math.min(dstH, placed.dy + placed.dh)
  if (x1 - x0 < 1 || y1 - y0 < 1) return null
  const srcX = ((x0 - placed.dx) / placed.dw) * srcW
  const srcY = ((y0 - placed.dy) / placed.dh) * srcH
  const srcWidth = ((x1 - x0) / placed.dw) * srcW
  const srcHeight = ((y1 - y0) / placed.dh) * srcH
  return {
    srcX,
    srcY,
    srcW: srcWidth,
    srcH: srcHeight,
    destX: x0,
    destY: y0,
    destW: x1 - x0,
    destH: y1 - y0,
  }
}

function layerBox(canvasW: number, canvasH: number, destX: number, destY: number, destW: number, destH: number) {
  const left = clampInt(destX, 0, canvasW - 1)
  const top = clampInt(destY, 0, canvasH - 1)
  const width = clampInt(destW, 1, canvasW - left)
  const height = clampInt(destH, 1, canvasH - top)
  return { left, top, width, height }
}

async function extractPlacedSource(
  source: Buffer,
  srcW: number,
  srcH: number,
  visible: NonNullable<ReturnType<typeof visiblePlacement>>,
  destW: number,
  destH: number
): Promise<Buffer> {
  const left = clampInt(visible.srcX, 0, srcW - 1)
  const top = clampInt(visible.srcY, 0, srcH - 1)
  const width = clampInt(visible.srcW, 1, srcW - left)
  const height = clampInt(visible.srcH, 1, srcH - top)
  return sharp(source)
    .extract({ left, top, width, height })
    .resize(Math.max(1, destW), Math.max(1, destH), { fit: 'fill' })
    .png()
    .toBuffer()
}

export async function renderPlacedBanner(input: {
  source: Buffer
  width: number
  height: number
  placed: PlacedRect
  background: { r: number; g: number; b: number }
}): Promise<Buffer> {
  const meta = await sharp(input.source).metadata()
  const srcW = meta.width || 0
  const srcH = meta.height || 0
  const visible = visiblePlacement(srcW, srcH, input.width, input.height, input.placed)
  const base = sharp({
    create: {
      width: input.width,
      height: input.height,
      channels: 3,
      background: input.background,
    },
  })
  if (!visible) return base.jpeg({ quality: 90 }).toBuffer()
  const box = layerBox(input.width, input.height, visible.destX, visible.destY, visible.destW, visible.destH)
  const layer = await extractPlacedSource(input.source, srcW, srcH, visible, box.width, box.height)
  return base
    .composite([{ input: layer, left: box.left, top: box.top }])
    .jpeg({ quality: 90 })
    .toBuffer()
}

export async function buildAiModelInput(input: {
  source: Buffer
  width: number
  height: number
  placed: PlacedRect
}): Promise<{ jpeg: Buffer; modelWidth: number; modelHeight: number }> {
  const scale = Math.min(1, MODEL_LONG_EDGE / Math.max(input.width, input.height))
  const modelWidth = Math.max(64, Math.round(input.width * scale))
  const modelHeight = Math.max(64, Math.round(input.height * scale))
  const placed = {
    dx: input.placed.dx * scale,
    dy: input.placed.dy * scale,
    dw: input.placed.dw * scale,
    dh: input.placed.dh * scale,
  }
  const jpeg = await renderPlacedBanner({
    source: input.source,
    width: modelWidth,
    height: modelHeight,
    placed,
    background: { r: 24, g: 24, b: 28 },
  })
  return { jpeg, modelWidth, modelHeight }
}

/**
 * Resize the generated fill to the exact banner, then paste the original photo
 * back on top so faces and logos are not redrawn or stretched.
 */
export async function fitGeneratedToBanner(input: {
  fill: Buffer
  width: number
  height: number
  maxBytes: number | null
}): Promise<{ jpeg: Buffer; withinCap: boolean; quality: number }> {
  const resized = await sharp(input.fill)
    .resize(input.width, input.height, { fit: 'fill' })
    .png()
    .toBuffer()
  const encoded = await encodeUnderCap(async (quality) => {
    const buf = await sharp(resized).jpeg({ quality: Math.round(quality * 100), mozjpeg: true }).toBuffer()
    return new Uint8Array(buf)
  }, input.maxBytes)
  return {
    jpeg: Buffer.from(encoded.bytes),
    withinCap: encoded.withinCap,
    quality: encoded.quality,
  }
}

export async function compositeSubjectOverFill(input: {
  source: Buffer
  fill: Buffer
  width: number
  height: number
  placed: PlacedRect
  maxBytes: number | null
}): Promise<{ jpeg: Buffer; withinCap: boolean; quality: number }> {
  const meta = await sharp(input.source).metadata()
  const srcW = meta.width || 0
  const srcH = meta.height || 0
  const visible = visiblePlacement(srcW, srcH, input.width, input.height, input.placed)
  const resizedFill = await sharp(input.fill)
    .resize(input.width, input.height, { fit: 'fill' })
    .png()
    .toBuffer()

  let flattened = resizedFill
  if (visible) {
    const box = layerBox(input.width, input.height, visible.destX, visible.destY, visible.destW, visible.destH)
    const layer = await extractPlacedSource(input.source, srcW, srcH, visible, box.width, box.height)
    flattened = await sharp(resizedFill)
      .composite([{ input: layer, left: box.left, top: box.top }])
      .png()
      .toBuffer()
  }

  const encoded = await encodeUnderCap(async (quality) => {
    const buf = await sharp(flattened).jpeg({ quality: Math.round(quality * 100), mozjpeg: true }).toBuffer()
    return new Uint8Array(buf)
  }, input.maxBytes)

  return {
    jpeg: Buffer.from(encoded.bytes),
    withinCap: encoded.withinCap,
    quality: encoded.quality,
  }
}
