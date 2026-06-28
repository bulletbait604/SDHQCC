'use client'

import { clampSeekSeconds } from '@/lib/thumbnailClipFrame'

/** Capture a single JPEG frame from a local video file (browser only). */
export async function extractVideoFrameAsJpeg(
  file: File,
  timeSec: number
): Promise<{ base64: string; mimeType: string }> {
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

    const seekTo = clampSeekSeconds(timeSec, video.duration)
    video.currentTime = seekTo
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve()
      video.onerror = () => reject(new Error('Could not seek video for frame capture'))
    })

    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) {
      throw new Error('Video has no readable frame dimensions')
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not create canvas for frame capture')
    ctx.drawImage(video, 0, 0, width, height)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const base64 = dataUrl.split(',')[1]
    if (!base64) throw new Error('Failed to encode video frame')

    return { base64, mimeType: 'image/jpeg' }
  } finally {
    URL.revokeObjectURL(url)
  }
}
