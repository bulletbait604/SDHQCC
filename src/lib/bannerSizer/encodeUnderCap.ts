export interface EncodedImage {
  bytes: Uint8Array
  quality: number
  withinCap: boolean
}

const QUALITIES = [0.92, 0.84, 0.76, 0.68, 0.58, 0.48, 0.38, 0.28]

/** Try JPEG qualities until the file fits. The smallest result is kept when none fit. */
export async function encodeUnderCap(
  encode: (quality: number) => Promise<Uint8Array>,
  maxBytes: number | null
): Promise<EncodedImage> {
  if (maxBytes == null) {
    const bytes = await encode(0.92)
    return { bytes, quality: 0.92, withinCap: true }
  }

  let smallest: EncodedImage | null = null
  for (const quality of QUALITIES) {
    const bytes = await encode(quality)
    const current = { bytes, quality, withinCap: bytes.byteLength <= maxBytes }
    if (!smallest || bytes.byteLength < smallest.bytes.byteLength) smallest = current
    if (current.withinCap) return current
  }
  return smallest || { bytes: new Uint8Array(), quality: 0.28, withinCap: false }
}
