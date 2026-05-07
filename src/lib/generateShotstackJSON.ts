import type { SafeZoneOffsets } from '@/lib/platformEditing'
import type { TargetPlatform } from '@/lib/platformEditing'

export interface GenerateShotstackInput {
  title?: string
  sourceUrl: string
  platform: TargetPlatform
  captionText?: string
  safeZone: SafeZoneOffsets
  shotstackEditPrompt?: string
}

type PacingProfile = {
  chunkSeconds: number
  introHookSeconds: number
  renderSeconds: number
}

function resolvePacingProfile(platform: TargetPlatform, prompt?: string): PacingProfile {
  const p = (prompt || '').toLowerCase()
  if (platform === 'youtube') {
    if (p.includes('fast') || p.includes('chaos')) {
      return { chunkSeconds: 1.8, introHookSeconds: 2, renderSeconds: 24 }
    }
    return { chunkSeconds: 2.2, introHookSeconds: 2, renderSeconds: 24 }
  }
  if (platform === 'reels') {
    if (p.includes('cinematic')) {
      return { chunkSeconds: 3.8, introHookSeconds: 3, renderSeconds: 24 }
    }
    return { chunkSeconds: 3.2, introHookSeconds: 3, renderSeconds: 24 }
  }
  // TikTok default: high cadence.
  return { chunkSeconds: 1.5, introHookSeconds: 3, renderSeconds: 24 }
}

function chunkCaption(text: string, wordsPerChunk: number): string[] {
  const words = text
    .trim()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
  if (!words.length) return []
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '))
  }
  return chunks
}

export function generateShotstackJSON({
  title = 'Viral Architect Output',
  sourceUrl,
  platform,
  captionText,
  safeZone,
  shotstackEditPrompt,
}: GenerateShotstackInput) {
  const pacing = resolvePacingProfile(platform, shotstackEditPrompt)
  const tracks: Array<{ clips: Array<Record<string, unknown>> }> = [{ clips: [] }]

  // Build the full edit from cuts of the uploaded source only.
  const cutLen =
    platform === 'reels' ? 3.5 : platform === 'youtube' ? 2.2 : 1.5
  let timelineCursor = 0
  let sourceCursor = 0
  while (timelineCursor < pacing.renderSeconds - 0.2) {
    const clipLen = Math.min(cutLen, pacing.renderSeconds - timelineCursor)
    tracks[0].clips.push({
      asset: {
        type: 'video',
        src: sourceUrl,
        trim: Number(sourceCursor.toFixed(2)),
      },
      start: Number(timelineCursor.toFixed(2)),
      length: Number(clipLen.toFixed(2)),
      // Shotstack: `crop` = scale to fill viewport while keeping aspect (like CSS object-fit: cover).
      // `cover` in Shotstack means stretch without preserving aspect ratio.
      fit: 'crop',
    })
    timelineCursor += clipLen
    sourceCursor += clipLen
  }

  if (captionText) {
    const wordsPerChunk = platform === 'reels' ? 8 : platform === 'youtube' ? 6 : 4
    const chunks = chunkCaption(captionText, wordsPerChunk)
    const captionClips: Array<Record<string, unknown>> = []
    let cursor = 0

    for (const chunk of chunks) {
      if (cursor >= pacing.renderSeconds - 0.2) break
      const maxLen = Math.max(0.9, Math.min(pacing.chunkSeconds, pacing.renderSeconds - cursor))
      captionClips.push({
        asset: {
          type: 'title',
          text: chunk,
          style: 'minimal',
          size: 'small',
        },
        start: Number(cursor.toFixed(2)),
        length: Number(maxLen.toFixed(2)),
        offset: {
          x: safeZone.captionX,
          y: safeZone.captionY,
        },
      })
      cursor += pacing.chunkSeconds
    }

    // Shorts loop behavior: mirror first caption in final 2 seconds.
    if (platform === 'youtube' && captionClips.length > 0) {
      const firstText = (captionClips[0].asset as Record<string, unknown>).text
      captionClips.push({
        asset: {
          type: 'title',
          text: firstText,
          style: 'minimal',
          size: 'small',
        },
        start: Math.max(0, pacing.renderSeconds - 2),
        length: 2,
        offset: {
          x: safeZone.captionX,
          y: safeZone.captionY,
        },
      })
    }

    tracks.push({
      clips: captionClips,
    })
  }

  return {
    timeline: {
      background: '#000000',
      tracks,
    },
    output: {
      format: 'mp4',
      // Custom size: Shotstack docs say to omit `resolution` and `aspectRatio` when using `size`.
      size: {
        width: 1080,
        height: 1920,
      },
      fps: 30,
    },
    metadata: {
      title,
      safeZoneClearBottomPct: safeZone.clearBottomPct,
      platform,
      pacingProfile: {
        chunkSeconds: pacing.chunkSeconds,
        introHookSeconds: pacing.introHookSeconds,
      },
      ...(shotstackEditPrompt
        ? {
            aiShotstackEditPrompt: shotstackEditPrompt,
          }
        : {}),
    },
  }
}
