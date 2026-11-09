import sharp from 'sharp'

const MASTER_SIZE = 1024

export interface ProcessedEmote {
  png: Buffer
  width: number
  height: number
  backgroundRemoved: boolean
}

interface RgbaImage {
  data: Buffer
  width: number
  height: number
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

async function toRgba(input: Buffer): Promise<RgbaImage> {
  const { data, info } = await sharp(input, { animated: false, pages: 1 })
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

function sampleCorners(image: RgbaImage): { flat: boolean; transparent: boolean; r: number; g: number; b: number } {
  const span = Math.max(1, Math.min(6, Math.floor(Math.min(image.width, image.height) / 8)))
  const points: Array<[number, number]> = []
  for (let y = 0; y < span; y++) {
    for (let x = 0; x < span; x++) {
      points.push(
        [x, y],
        [image.width - 1 - x, y],
        [x, image.height - 1 - y],
        [image.width - 1 - x, image.height - 1 - y]
      )
    }
  }
  let r = 0
  let g = 0
  let b = 0
  let a = 0
  let minR = 255
  let maxR = 0
  let minG = 255
  let maxG = 0
  let minB = 255
  let maxB = 0
  for (const [x, y] of points) {
    const i = (y * image.width + x) * 4
    const pr = image.data[i] ?? 0
    const pg = image.data[i + 1] ?? 0
    const pb = image.data[i + 2] ?? 0
    const pa = image.data[i + 3] ?? 0
    r += pr
    g += pg
    b += pb
    a += pa
    minR = Math.min(minR, pr)
    maxR = Math.max(maxR, pr)
    minG = Math.min(minG, pg)
    maxG = Math.max(maxG, pg)
    minB = Math.min(minB, pb)
    maxB = Math.max(maxB, pb)
  }
  const count = points.length || 1
  return {
    flat: maxR - minR <= 14 && maxG - minG <= 14 && maxB - minB <= 14,
    transparent: a / count < 12,
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  }
}

function keyRange(r: number, g: number, b: number): { hard: number; soft: number } {
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  if (spread < 28) return { hard: 14, soft: 32 }
  return { hard: 46, soft: 96 }
}

/** Returns the share of pixels whose alpha was reduced. Mutates `image`. */
function knockOut(image: RgbaImage, key: { r: number; g: number; b: number }): number {
  const { hard, soft } = keyRange(key.r, key.g, key.b)
  let changed = 0
  const pixels = image.width * image.height
  for (let i = 0; i < image.data.length; i += 4) {
    const pr = image.data[i] ?? 0
    const pg = image.data[i + 1] ?? 0
    const pb = image.data[i + 2] ?? 0
    const dr = pr - key.r
    const dg = pg - key.g
    const db = pb - key.b
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)
    if (dist >= soft) continue
    const current = image.data[i + 3] ?? 0
    const scale = dist <= hard ? 0 : (dist - hard) / (soft - hard)
    const next = Math.round(current * scale)
    if (next < current) changed += 1
    image.data[i + 3] = next
    if (next > 0 && next < 255) {
      const alpha = next / 255
      image.data[i] = clampByte((pr - key.r * (1 - alpha)) / alpha)
      image.data[i + 1] = clampByte((pg - key.g * (1 - alpha)) / alpha)
      image.data[i + 2] = clampByte((pb - key.b * (1 - alpha)) / alpha)
    }
  }
  return pixels > 0 ? changed / pixels : 0
}

function tryKey(image: RgbaImage, key: { r: number; g: number; b: number }): Buffer | null {
  const copy: RgbaImage = { data: Buffer.from(image.data), width: image.width, height: image.height }
  const fraction = knockOut(copy, key)
  if (fraction < 0.08 || fraction > 0.92) return null
  return copy.data
}

async function squarePng(image: RgbaImage, size: number, trimTransparent: boolean): Promise<Buffer> {
  let base = await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: 4 },
  })
    .png()
    .toBuffer()

  if (trimTransparent) {
    try {
      const trimmed = await sharp(base).trim({ threshold: 8 }).png().toBuffer()
      const meta = await sharp(trimmed).metadata()
      if ((meta.width || 0) >= 8 && (meta.height || 0) >= 8) base = trimmed
    } catch {
      /* A flat image has nothing to trim. */
    }
  }

  const meta = await sharp(base).metadata()
  const width = meta.width || 1
  const height = meta.height || 1
  if (!trimTransparent) {
    return sharp(base)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
  }

  const pad = Math.max(2, Math.round(Math.max(width, height) * 0.08))
  const side = Math.max(width, height) + pad * 2
  const left = Math.floor((side - width) / 2)
  const top = Math.floor((side - height) / 2)
  return sharp(base)
    .extend({
      top,
      bottom: side - height - top,
      left,
      right: side - width - left,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(size, size, { fit: 'fill' })
    .png()
    .toBuffer()
}

/** First frame only. GIF animation is not passed through. */
export async function referenceForModel(input: Buffer): Promise<Buffer> {
  const jpeg = await sharp(input, { animated: false, pages: 1 })
    .rotate()
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 84 })
    .toBuffer()
  if (jpeg.length < 32) throw new Error('That reference image could not be read.')
  return jpeg
}

/**
 * Turn a generated still into a square PNG.
 * A flat corner color (the requested magenta, or whatever flat field the model used) becomes transparent.
 */
export async function processGeneratedEmote(input: {
  image: Buffer
  transparent: boolean
  size?: number
}): Promise<ProcessedEmote> {
  const size = input.size && input.size >= 16 ? Math.round(input.size) : MASTER_SIZE
  const rgba = await toRgba(input.image)
  let backgroundRemoved = false
  if (input.transparent) {
    const corners = sampleCorners(rgba)
    if (corners.transparent) {
      backgroundRemoved = true
    } else {
      const keyed = (corners.flat ? tryKey(rgba, corners) : null) || tryKey(rgba, { r: 255, g: 0, b: 255 })
      if (keyed) {
        rgba.data = keyed
        backgroundRemoved = true
      }
    }
  }
  const png = await squarePng(rgba, size, backgroundRemoved)
  return { png, width: size, height: size, backgroundRemoved }
}
