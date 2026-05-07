import type { SafeZoneOffsets } from '@/lib/platformEditing'
import type { TargetPlatform } from '@/lib/platformEditing'

export interface GenerateShotstackInput {
  title?: string
  sourceUrl: string
  platform: TargetPlatform
  captionText?: string
  safeZone: SafeZoneOffsets
  shotstackEditPrompt?: string
  /** Optional AI copy — used to pick motion intensity and hook text fallback. */
  hookPlan?: string
  pacePlan?: string
}

type PacingProfile = {
  chunkSeconds: number
  introHookSeconds: number
  renderSeconds: number
}

type VideoSeg = {
  start: number
  length: number
  trim: number
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

function combinedMood(
  platform: TargetPlatform,
  shotstackEditPrompt?: string,
  hookPlan?: string,
  pacePlan?: string
): string {
  return `${shotstackEditPrompt || ''} ${hookPlan || ''} ${pacePlan || ''}`.toLowerCase()
}

function motionPalette(
  platform: TargetPlatform,
  mood: string
): readonly [string, string, string, string] {
  if (mood.includes('cinematic') || mood.includes('slow')) {
    return ['zoomInSlow', 'slideUpSlow', 'zoomOutSlow', 'slideRightSlow'] as const
  }
  if (platform === 'reels') {
    return ['zoomInSlow', 'slideUp', 'zoomOut', 'slideRight'] as const
  }
  if (platform === 'youtube') {
    return ['zoomIn', 'slideLeft', 'zoomOut', 'slideRight'] as const
  }
  // TikTok / chaos pacing
  if (mood.includes('chaos') || mood.includes('fast')) {
    return ['zoomInFast', 'slideRightFast', 'zoomOutFast', 'slideLeftFast'] as const
  }
  return ['zoomInFast', 'slideRightFast', 'zoomOutFast', 'slideLeftFast'] as const
}

function pickEffect(
  index: number,
  segStart: number,
  palette: readonly [string, string, string, string],
  introHookSeconds: number
): string {
  const hookBoost = segStart < introHookSeconds - 0.05
  if (hookBoost) {
    return palette[0].includes('Fast') ? 'zoomInFast' : 'zoomInSlow'
  }
  return palette[index % palette.length]!
}

/** Shotstack TextAsset. @see https://shotstack.io/docs/api/ */
function buildCaptionTextAsset(
  text: string,
  platform: TargetPlatform,
  opts?: { typewriter?: boolean }
): Record<string, unknown> {
  const fontSize = platform === 'reels' ? 36 : platform === 'youtube' ? 32 : 40
  const asset: Record<string, unknown> = {
    type: 'text',
    text,
    width: 960,
    height: 260,
    font: {
      family: 'Montserrat ExtraBold',
      color: '#ffffff',
      size: fontSize,
      weight: 700,
      lineHeight: 1.12,
    },
    alignment: {
      horizontal: 'center',
      vertical: 'center',
    },
    stroke: {
      width: 2,
      color: '#000000',
    },
    background: {
      color: '#000000',
      opacity: 0.42,
      padding: 10,
      borderRadius: 6,
    },
  }
  if (opts?.typewriter) {
    asset.animation = { preset: 'typewriter', duration: 0.55 }
  }
  return asset
}

function buildHookSplashAsset(line: string, platform: TargetPlatform): Record<string, unknown> {
  const fontSize = platform === 'reels' ? 52 : platform === 'youtube' ? 46 : 54
  return {
    type: 'text',
    text: line,
    width: 1000,
    height: 400,
    font: {
      family: 'Montserrat ExtraBold',
      color: '#ffffff',
      size: fontSize,
      weight: 800,
      lineHeight: 1.05,
    },
    alignment: { horizontal: 'center', vertical: 'center' },
    stroke: { width: 3, color: '#000000' },
    background: { color: '#0a0a0a', opacity: 0.55, padding: 16, borderRadius: 10 },
    animation: { preset: 'typewriter', duration: 0.7 },
  }
}

export function generateShotstackJSON({
  title = 'Viral Architect Output',
  sourceUrl,
  platform,
  captionText,
  safeZone,
  shotstackEditPrompt,
  hookPlan,
  pacePlan,
}: GenerateShotstackInput) {
  const mood = combinedMood(platform, shotstackEditPrompt, hookPlan, pacePlan)
  const pacing = resolvePacingProfile(platform, shotstackEditPrompt)
  const palette = motionPalette(platform, mood)

  const cutLen =
    platform === 'reels' ? 3.5 : platform === 'youtube' ? 2.2 : 1.5
  const segments: VideoSeg[] = []
  let timelineCursor = 0
  let sourceCursor = 0
  while (timelineCursor < pacing.renderSeconds - 0.2) {
    const clipLen = Math.min(cutLen, pacing.renderSeconds - timelineCursor)
    segments.push({
      start: Number(timelineCursor.toFixed(2)),
      length: Number(clipLen.toFixed(2)),
      trim: Number(sourceCursor.toFixed(2)),
    })
    timelineCursor += clipLen
    sourceCursor += clipLen
  }

  const mainClips: Array<Record<string, unknown>> = []
  segments.forEach((s, index) => {
    const effect = pickEffect(index, s.start, palette, pacing.introHookSeconds)
    mainClips.push({
      asset: {
        type: 'video',
        src: sourceUrl,
        trim: s.trim,
        transcode: true,
      },
      start: s.start,
      length: s.length,
      fit: 'crop',
      effect,
      transition: {
        in: index === 0 ? 'fade' : 'fadeFast',
        out: 'fadeFast',
      },
    })
  })

  const tracks: Array<{ clips: Array<Record<string, unknown>> }> = [{ clips: mainClips }]

  // Corner "b-roll" pass: same upload, offset trim, picture-in-picture (no extra media URLs).
  const pipClips: Array<Record<string, unknown>> = []
  segments.forEach((s, i) => {
    if (s.length < 1.35) return
    const pipLen = Number(Math.min(1.45, s.length * 0.52).toFixed(2))
    const pipStart = Number((s.start + Math.max(0.12, (s.length - pipLen) * 0.28)).toFixed(2))
    const trimOffset = Math.min(2.8, Math.max(0.35, s.length * 0.22))
    const pipTrim = Number((s.trim + trimOffset).toFixed(2))
    pipClips.push({
      asset: {
        type: 'video',
        src: sourceUrl,
        trim: pipTrim,
        transcode: true,
      },
      start: pipStart,
      length: pipLen,
      fit: 'crop',
      scale: 0.36,
      position: i % 2 === 0 ? 'topRight' : 'bottomLeft',
      offset: { x: i % 2 === 0 ? 0.04 : -0.04, y: i % 2 === 0 ? 0.06 : -0.06 },
      transition: { in: 'fade', out: 'fade' },
      effect: i % 3 === 0 ? 'zoomInSlow' : 'none',
    })
  })
  if (pipClips.length) {
    tracks.push({ clips: pipClips })
  }

  const onScreenCopy = (captionText || '').trim()
  const hookLine =
    onScreenCopy.split(/\n+/)[0]?.slice(0, 48).trim() ||
    (hookPlan || '').trim().split(/\n+/)[0]?.slice(0, 48).trim() ||
    ''

  let captionStartOffset = 0
  if (hookLine.length >= 6) {
    tracks.push({
      clips: [
        {
          asset: buildHookSplashAsset(hookLine, platform),
          start: 0,
          length: 1.65,
          transition: { in: 'fade', out: 'fadeFast' },
        },
      ],
    })
    captionStartOffset = 1.75
  }

  if (onScreenCopy) {
    const wordsPerChunk = platform === 'reels' ? 8 : platform === 'youtube' ? 6 : 4
    const chunks = chunkCaption(onScreenCopy, wordsPerChunk)
    const captionClips: Array<Record<string, unknown>> = []
    let cursor = captionStartOffset

    chunks.forEach((chunk, ci) => {
      if (cursor >= pacing.renderSeconds - 0.2) return
      const maxLen = Math.max(0.9, Math.min(pacing.chunkSeconds, pacing.renderSeconds - cursor))
      captionClips.push({
        asset: buildCaptionTextAsset(chunk, platform, { typewriter: ci === 0 }),
        start: Number(cursor.toFixed(2)),
        length: Number(maxLen.toFixed(2)),
        offset: {
          x: safeZone.captionX,
          y: safeZone.captionY,
        },
        transition: { in: 'fade', out: 'fadeFast' },
      })
      cursor += pacing.chunkSeconds
    })

    if (platform === 'youtube' && captionClips.length > 0) {
      const firstText = (captionClips[0].asset as Record<string, unknown>).text
      captionClips.push({
        asset: buildCaptionTextAsset(String(firstText), platform),
        start: Math.max(0, pacing.renderSeconds - 2),
        length: 2,
        offset: {
          x: safeZone.captionX,
          y: safeZone.captionY,
        },
        transition: { in: 'fade', out: 'fade' },
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
