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
  /**
   * Landscape / webcam → 9:16 vertical output (1080×1920).
   * `crop` (default): scale and center-crop to fill the frame (typical Shorts/TikTok look).
   * `letterbox`: fit entire horizontal frame inside vertical with black bars top/bottom.
   */
  landscapeMode?: 'crop' | 'letterbox'
  editBlueprint?: {
    cutSeconds?: number
    introHookSeconds?: number
    renderSeconds?: number
    captionWordsPerChunk?: number
    overlayTexts?: string[]
    preferredTransitions?: string[]
  }
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

type TransitionName =
  | 'fade'
  | 'reveal'
  | 'wipeLeft'
  | 'wipeRight'
  | 'slideLeft'
  | 'slideRight'
  | 'slideUp'
  | 'slideDown'
  | 'zoom'

const SAFE_TRANSITIONS: readonly TransitionName[] = [
  'fade',
  'reveal',
  'wipeLeft',
  'wipeRight',
  'slideLeft',
  'slideRight',
  'slideUp',
  'slideDown',
  'zoom',
] as const

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function normalizeTransition(value: string): TransitionName | null {
  const v = value.trim()
  return (SAFE_TRANSITIONS as readonly string[]).includes(v) ? (v as TransitionName) : null
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
  // Use only stable built-in effect names supported across Edit API environments.
  if (mood.includes('cinematic') || mood.includes('slow')) {
    return ['zoomIn', 'slideUp', 'zoomOut', 'slideRight'] as const
  }
  if (platform === 'reels') {
    return ['zoomIn', 'slideUp', 'zoomOut', 'slideRight'] as const
  }
  if (platform === 'youtube') {
    return ['zoomIn', 'slideLeft', 'zoomOut', 'slideRight'] as const
  }
  // TikTok / high-energy cadence still uses compatible effect names.
  if (mood.includes('chaos') || mood.includes('fast')) {
    return ['zoomIn', 'slideRight', 'zoomOut', 'slideLeft'] as const
  }
  return ['zoomIn', 'slideRight', 'zoomOut', 'slideLeft'] as const
}

function pickEffect(
  index: number,
  segStart: number,
  palette: readonly [string, string, string, string],
  introHookSeconds: number
): string {
  const hookBoost = segStart < introHookSeconds - 0.05
  if (hookBoost) {
    return 'zoomIn'
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
  landscapeMode = 'crop',
  editBlueprint,
}: GenerateShotstackInput) {
  const mood = combinedMood(platform, shotstackEditPrompt, hookPlan, pacePlan)
  const pacingBase = resolvePacingProfile(platform, shotstackEditPrompt)
  const pacing: PacingProfile = {
    chunkSeconds: clamp(editBlueprint?.cutSeconds ?? pacingBase.chunkSeconds, 1.0, 4.5),
    introHookSeconds: clamp(editBlueprint?.introHookSeconds ?? pacingBase.introHookSeconds, 1.0, 5.0),
    renderSeconds: clamp(editBlueprint?.renderSeconds ?? pacingBase.renderSeconds, 8.0, 45.0),
  }
  const palette = motionPalette(platform, mood)
  /** Main full-frame video: fill vertical with center crop, or letterbox horizontal sources. */
  const mainFit = landscapeMode === 'letterbox' ? 'contain' : 'crop'

  const cutLen = pacing.chunkSeconds
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

  const requestedTransitions = (editBlueprint?.preferredTransitions || [])
    .map((t) => normalizeTransition(t))
    .filter((t): t is TransitionName => t !== null)
  const fallbackTransitions: readonly TransitionName[] =
    platform === 'reels'
      ? (['fade', 'slideUp', 'slideLeft'] as const)
      : platform === 'youtube'
        ? (['fade', 'slideLeft', 'wipeLeft'] as const)
        : (['fade', 'slideRight', 'wipeRight'] as const)
  const transitionPool = requestedTransitions.length ? requestedTransitions : fallbackTransitions

  const mainClips: Array<Record<string, unknown>> = []
  segments.forEach((s, index) => {
    const effect = pickEffect(index, s.start, palette, pacing.introHookSeconds)
    const transition = transitionPool[index % transitionPool.length] || 'fade'
    mainClips.push({
      asset: {
        type: 'video',
        src: sourceUrl,
        trim: s.trim,
        transcode: true,
      },
      start: s.start,
      length: s.length,
      fit: mainFit,
      position: 'center',
      effect,
      transition,
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
      transition: 'fade',
      effect: i % 3 === 0 ? 'zoomIn' : 'none',
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
          transition: 'fade',
        },
      ],
    })
    captionStartOffset = 1.75
  }

  if (onScreenCopy) {
    const defaultWordsPerChunk = platform === 'reels' ? 8 : platform === 'youtube' ? 6 : 4
    const wordsPerChunk = Math.round(
      clamp(editBlueprint?.captionWordsPerChunk ?? defaultWordsPerChunk, 3, 14)
    )
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
        transition: 'fade',
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
        transition: 'fade',
      })
    }

    tracks.push({
      clips: captionClips,
    })
  }

  const overlayTexts = (editBlueprint?.overlayTexts || [])
    .map((line) => line.trim())
    .filter((line) => line.length >= 3)
    .slice(0, 6)
  if (overlayTexts.length) {
    const overlayStep = Math.max(1.8, pacing.renderSeconds / (overlayTexts.length + 1))
    const overlayClips: Array<Record<string, unknown>> = []
    overlayTexts.forEach((line, i) => {
      const start = Number((0.8 + i * overlayStep).toFixed(2))
      if (start >= pacing.renderSeconds - 0.5) return
      overlayClips.push({
        asset: {
          type: 'text',
          text: line.slice(0, 70),
          width: 700,
          height: 120,
          font: {
            family: 'Montserrat ExtraBold',
            color: '#f5f8ff',
            size: platform === 'reels' ? 34 : platform === 'youtube' ? 30 : 36,
            weight: 700,
          },
          alignment: { horizontal: 'center', vertical: 'center' },
          background: {
            color: '#04121f',
            opacity: 0.45,
            padding: 8,
            borderRadius: 8,
          },
          stroke: { width: 2, color: '#000000' },
        },
        start,
        length: 1.25,
        offset: {
          x: 0,
          y: safeZone.captionY + 0.28,
        },
        transition: 'slideUp',
      })
    })
    if (overlayClips.length) tracks.push({ clips: overlayClips })
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
      landscapeToVertical: landscapeMode,
      ...(shotstackEditPrompt
        ? {
            aiShotstackEditPrompt: shotstackEditPrompt,
          }
        : {}),
    },
  }
}
