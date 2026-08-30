'use client'

import { clampSeekSeconds } from '@/lib/thumbnailClipFrame'

export type ExtractFrameOpts = {
  maxWidth?: number
  quality?: number
}

function captureJpegFromVideo(
  video: HTMLVideoElement,
  options?: ExtractFrameOpts
): { base64: string; mimeType: string } {
  let width = video.videoWidth
  let height = video.videoHeight
  if (!width || !height) {
    throw new Error('Video has no readable frame dimensions')
  }
  const maxWidth = options?.maxWidth
  if (maxWidth && width > maxWidth) {
    height = Math.round((height * maxWidth) / width)
    width = maxWidth
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas for frame capture')
  ctx.drawImage(video, 0, 0, width, height)

  const quality = options?.quality ?? 0.92
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('Failed to encode video frame')

  return { base64, mimeType: 'image/jpeg' }
}

async function seekVideo(video: HTMLVideoElement, timeSec: number): Promise<number> {
  const seekTo = clampSeekSeconds(timeSec, video.duration)
  if (Math.abs(video.currentTime - seekTo) < 0.04) {
    return seekTo
  }
  await new Promise<void>((resolve, reject) => {
    video.onseeked = () => resolve()
    video.onerror = () => reject(new Error('Could not seek video for frame capture'))
    video.currentTime = seekTo
  })
  return seekTo
}

/** Capture several JPEG frames from one local video (loads the file once). */
export async function extractVideoFramesAsJpeg(
  file: File,
  timesSec: number[],
  options?: ExtractFrameOpts
): Promise<{ timeSec: number; base64: string; mimeType: string }[]> {
  if (timesSec.length === 0) return []
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error('Could not load video for frame capture'))
      video.src = url
    })

    const results: { timeSec: number; base64: string; mimeType: string }[] = []
    for (const timeSec of timesSec) {
      const seekTo = await seekVideo(video, timeSec)
      const jpeg = captureJpegFromVideo(video, options)
      results.push({ timeSec: seekTo, ...jpeg })
    }
    return results
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Capture a single JPEG frame from a local video file (browser only). */
export async function extractVideoFrameAsJpeg(
  file: File,
  timeSec: number,
  options?: ExtractFrameOpts
): Promise<{ base64: string; mimeType: string }> {
  const [frame] = await extractVideoFramesAsJpeg(file, [timeSec], options)
  if (!frame) throw new Error('Failed to encode video frame')
  return { base64: frame.base64, mimeType: frame.mimeType }
}
