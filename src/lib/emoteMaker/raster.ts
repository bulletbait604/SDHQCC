/** Posterize RGB so a PNG compresses under a small chat-file cap. Low alpha becomes clear. */
export function quantizeRgba(data: Uint8ClampedArray | Buffer, levels: number): void {
  const steps = Math.max(2, Math.round(levels))
  const step = 255 / (steps - 1)
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] ?? 0
    if (alpha < 12) {
      data[i + 3] = 0
      continue
    }
    data[i] = Math.round(Math.round((data[i] ?? 0) / step) * step)
    data[i + 1] = Math.round(Math.round((data[i + 1] ?? 0) / step) * step)
    data[i + 2] = Math.round(Math.round((data[i + 2] ?? 0) / step) * step)
  }
}
