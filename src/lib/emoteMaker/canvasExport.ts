import { fitsByteCap, type ByteCap } from '@/lib/emoteMaker/presets'
import { emotePlacement, type EmoteFrame } from '@/lib/emoteMaker/placement'
import { quantizeRgba } from '@/lib/emoteMaker/raster'

export interface EncodedEmote {
  bytes: Uint8Array
  mime: 'image/png' | 'image/webp'
  extension: 'png' | 'webp'
  withinCap: boolean
}

function canvasBytes(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not encode that emote.'))
          return
        }
        void blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject)
      },
      type,
      quality
    )
  })
}

export function paintEmote(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  srcW: number,
  srcH: number,
  size: number,
  frame: EmoteFrame,
  crisp: boolean
) {
  ctx.clearRect(0, 0, size, size)
  ctx.imageSmoothingEnabled = !crisp
  const placed = emotePlacement(srcW, srcH, size, frame)
  ctx.drawImage(image, placed.dx, placed.dy, placed.dw, placed.dh)
}

function paintSize(
  image: CanvasImageSource,
  srcW: number,
  srcH: number,
  size: number,
  frame: EmoteFrame,
  crisp: boolean
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  paintEmote(ctx, image, srcW, srcH, size, frame, crisp)
  return canvas
}

function quantizeCopy(source: HTMLCanvasElement, levels: number): HTMLCanvasElement {
  const copy = document.createElement('canvas')
  copy.width = source.width
  copy.height = source.height
  const ctx = copy.getContext('2d', { willReadFrequently: true })
  if (!ctx) return copy
  ctx.drawImage(source, 0, 0)
  const pixels = ctx.getImageData(0, 0, copy.width, copy.height)
  quantizeRgba(pixels.data, levels)
  ctx.putImageData(pixels, 0, 0)
  return copy
}

export async function encodeEmoteUnderCap(input: {
  image: CanvasImageSource
  srcW: number
  srcH: number
  size: number
  frame: EmoteFrame
  crisp: boolean
  maxBytes: number | null
  byteCap: ByteCap
  allowWebp: boolean
}): Promise<EncodedEmote> {
  const cap = { maxBytes: input.maxBytes, byteCap: input.byteCap }
  const source = paintSize(input.image, input.srcW, input.srcH, input.size, input.frame, input.crisp)
  const attempts: HTMLCanvasElement[] = [source]
  for (const levels of [32, 16, 8]) attempts.push(quantizeCopy(source, levels))

  let smallest: EncodedEmote | null = null
  for (const canvas of attempts) {
    const bytes = await canvasBytes(canvas, 'image/png')
    const current: EncodedEmote = {
      bytes,
      mime: 'image/png',
      extension: 'png',
      withinCap: fitsByteCap(bytes.byteLength, cap),
    }
    if (!smallest || bytes.byteLength < smallest.bytes.byteLength) smallest = current
    if (current.withinCap) return current
  }

  if (input.allowWebp) {
    for (const quality of [0.86, 0.7, 0.54, 0.38]) {
      const bytes = await canvasBytes(source, 'image/webp', quality)
      const current: EncodedEmote = {
        bytes,
        mime: 'image/webp',
        extension: 'webp',
        withinCap: fitsByteCap(bytes.byteLength, cap),
      }
      if (!smallest || bytes.byteLength < smallest.bytes.byteLength) smallest = current
      if (current.withinCap) return current
    }
  }

  return smallest || { bytes: new Uint8Array(), mime: 'image/png', extension: 'png', withinCap: false }
}

export function canvasHasTransparency(image: CanvasImageSource, srcW: number, srcH: number): boolean {
  const size = 48
  const canvas = paintSize(image, srcW, srcH, size, { zoom: 1, panX: 0, panY: 0 }, false)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  const pixels = ctx.getImageData(0, 0, size, size).data
  for (let i = 3; i < pixels.length; i += 16) {
    if ((pixels[i] ?? 255) < 250) return true
  }
  return false
}
