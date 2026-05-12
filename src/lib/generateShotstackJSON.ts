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
    sourceMoments?: SourceMoment[]
  }
  /** Optional detected source duration in seconds from client metadata. */
  sourceDurationSeconds?: number
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

type SourceMoment = {
  startSeconds?: number
  endSeconds?: number
  start?: number
  end?: number
  reason?: string
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
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

function readMomentTime(moment: SourceMoment, primary: 'startSeconds' | 'endSeconds', fallback: 'start' | 'end'): number | null {
  const value = moment[primary] ?? moment[fallback]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeSourceMoments(
  sourceMoments: SourceMoment[] | undefined,
  sourceDurationCap: number | null
): Array<{ start: number; end: number }> {
  const maxEnd = sourceDurationCap ?? 90
  return (sourceMoments || [])
    .map((moment) => {
      const rawStart = readMomentTime(moment, 'startSeconds', 'start')
      const rawEnd = readMomentTime(moment, 'endSeconds', 'end')
      if (rawStart == null || rawEnd == null) return null
      const start = clamp(rawStart, 0, maxEnd)
      const end = clamp(rawEnd, start, maxEnd)
      if (end - start < 0.45) return null
      return { start, end }
    })
    .filter((moment): moment is { start: number; end: number } => moment !== null)
    .slice(0, 12)
}

function buildSourceMomentSegments(
  sourceMoments: SourceMoment[] | undefined,
  pacing: PacingProfile,
  sourceDurationCap: number | null
): VideoSeg[] {
  const moments = normalizeSourceMoments(sourceMoments, sourceDurationCap)
  if (!moments.length) return []

  const cutLen = pacing.chunkSeconds
  const segments: VideoSeg[] = []
  let timelineCursor = 0
  let segIndex = 0

  for (const moment of moments) {
    let sourceCursor = moment.start
    while (sourceCursor < moment.end - 0.3 && timelineCursor < pacing.renderSeconds - 0.2) {
      const jitterScale = segIndex % 3 === 0 ? 1.16 : segIndex % 3 === 1 ? 0.86 : 1.02
      const desiredLen = clamp(cutLen * jitterScale, Math.max(0.9, cutLen * 0.72), cutLen * 1.28)
      const clipLen = Math.min(desiredLen, moment.end - sourceCursor, pacing.renderSeconds - timelineCursor)
      if (clipLen < 0.45) break
      segments.push({
        start: Number(timelineCursor.toFixed(2)),
        length: Number(clipLen.toFixed(2)),
        trim: Number(sourceCursor.toFixed(2)),
      })
      timelineCursor += clipLen
      sourceCursor += clipLen * (segIndex % 2 === 0 ? 1.02 : 0.94)
      segIndex += 1
    }
  }

  return segments
}

export function generateShotstackJSON({
  title = 'Viral Architect Output',
  sourceUrl,
  platform,
  safeZone,
  shotstackEditPrompt,
  landscapeMode = 'crop',
  editBlueprint,
  sourceDurationSeconds,
}: GenerateShotstackInput) {
  const pacingBase = resolvePacingProfile(platform, shotstackEditPrompt)
  const requestedRenderSeconds = clamp(editBlueprint?.renderSeconds ?? pacingBase.renderSeconds, 8.0, 45.0)
  const sourceDurationCap =
    typeof sourceDurationSeconds === 'number' && Number.isFinite(sourceDurationSeconds)
      ? clamp(sourceDurationSeconds - 0.2, 2.5, 90)
      : null
  const pacing: PacingProfile = {
    chunkSeconds: clamp(editBlueprint?.cutSeconds ?? pacingBase.chunkSeconds, 1.0, 4.5),
    introHookSeconds: clamp(editBlueprint?.introHookSeconds ?? pacingBase.introHookSeconds, 1.0, 5.0),
    renderSeconds:
      sourceDurationCap != null
        ? Math.min(requestedRenderSeconds, sourceDurationCap)
        : requestedRenderSeconds,
  }
  /** Main full-frame video: fill vertical with center crop, or letterbox horizontal sources. */
  const mainFit = landscapeMode === 'letterbox' ? 'contain' : 'crop'

  const cutLen = pacing.chunkSeconds
  const maxSourceTrimStart =
    sourceDurationCap != null ? Math.max(0, sourceDurationCap - 0.9) : Number.POSITIVE_INFINITY
  const segments: VideoSeg[] = buildSourceMomentSegments(
    editBlueprint?.sourceMoments,
    pacing,
    sourceDurationCap
  )
  const hasUsableSourceMoments = segments.length > 0
  let timelineCursor = segments.reduce((sum, segment) => sum + segment.length, 0)
  let sourceCursor = 0
  let segIndex = segments.length
  while (!hasUsableSourceMoments && timelineCursor < pacing.renderSeconds - 0.2) {
    const jitterScale = segIndex % 3 === 0 ? 1.16 : segIndex % 3 === 1 ? 0.86 : 1.02
    const desiredLen = clamp(cutLen * jitterScale, Math.max(0.9, cutLen * 0.72), cutLen * 1.28)
    const clipLen = Math.min(desiredLen, pacing.renderSeconds - timelineCursor)
    const boundedTrim =
      maxSourceTrimStart === Number.POSITIVE_INFINITY
        ? sourceCursor
        : Math.min(sourceCursor, maxSourceTrimStart)
    segments.push({
      start: Number(timelineCursor.toFixed(2)),
      length: Number(clipLen.toFixed(2)),
      trim: Number(boundedTrim.toFixed(2)),
    })
    timelineCursor += clipLen
    // Move through source with a slight stride offset to reduce mechanical repetition.
    sourceCursor += clipLen * (segIndex % 2 === 0 ? 1.08 : 0.93)
    if (sourceDurationCap != null && sourceCursor > maxSourceTrimStart) {
      // Wrap into a different interior region instead of holding on the last frames.
      sourceCursor = Math.max(0.4, (sourceCursor - maxSourceTrimStart) * 0.35)
    }
    segIndex += 1
  }

  const mainClips: Array<Record<string, unknown>> = []
  segments.forEach((s, index) => {
    const clip: Record<string, unknown> = {
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
    }
    if (index === 0) {
      clip.transition = { in: 'fade' }
    }
    mainClips.push(clip)
  })

  const tracks: Array<{ clips: Array<Record<string, unknown>> }> = [{ clips: mainClips }]

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
