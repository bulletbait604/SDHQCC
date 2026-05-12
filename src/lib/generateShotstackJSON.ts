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
    textOverlays?: TimedTextOverlay[]
    subtitles?: TimedTextOverlay[]
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
  sourceMomentIndex?: number
  effect?: 'zoomInSlow' | 'zoomOutSlow'
}

type SourceMoment = {
  startSeconds?: number
  endSeconds?: number
  start?: number
  end?: number
  reason?: string
  visualTreatment?: 'none' | 'slowZoomIn' | 'slowZoomOut'
}

type TimedTextOverlay = {
  text?: string
  timelineStartSeconds?: number
  sourceStartSeconds?: number
  sourceMomentIndex?: number
  offsetSeconds?: number
  startSeconds?: number
  start?: number
  durationSeconds?: number
  length?: number
  position?: 'top' | 'middle' | 'bottom'
  type?: 'subtitle' | 'callout'
}

type OverlayPlacement = {
  start: number
  maxEnd: number
  minStart: number
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

function normalizeVisualTreatment(value: SourceMoment['visualTreatment']): VideoSeg['effect'] | undefined {
  if (value === 'slowZoomOut') return 'zoomOutSlow'
  if (value === 'slowZoomIn') return 'zoomInSlow'
  return undefined
}

function normalizeSourceMoments(
  sourceMoments: SourceMoment[] | undefined,
  sourceDurationCap: number | null
): Array<{ start: number; end: number; effect?: VideoSeg['effect']; sourceMomentIndex: number }> {
  const maxEnd = sourceDurationCap ?? 90
  const moments: Array<{ start: number; end: number; effect?: VideoSeg['effect']; sourceMomentIndex: number }> = []
  const sourceList = sourceMoments || []
  for (let sourceMomentIndex = 0; sourceMomentIndex < sourceList.length; sourceMomentIndex++) {
    const moment = sourceList[sourceMomentIndex]!
    const rawStart = readMomentTime(moment, 'startSeconds', 'start')
    const rawEnd = readMomentTime(moment, 'endSeconds', 'end')
    if (rawStart == null || rawEnd == null) continue
    const start = clamp(rawStart, 0, maxEnd)
    const end = clamp(rawEnd, start, maxEnd)
    if (end - start < 0.45) continue
    const effect = normalizeVisualTreatment(moment.visualTreatment)
    moments.push(effect ? { start, end, effect, sourceMomentIndex } : { start, end, sourceMomentIndex })
    if (moments.length >= 12) break
  }
  return moments
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
        sourceMomentIndex: moment.sourceMomentIndex,
        effect: segments.length < 3 && sourceCursor === moment.start ? moment.effect : undefined,
      })
      timelineCursor += clipLen
      sourceCursor += clipLen * (segIndex % 2 === 0 ? 1.02 : 0.94)
      segIndex += 1
    }
  }

  return segments
}

function nextFallbackTrim(segments: VideoSeg[], sourceDurationCap: number | null): number {
  const lastSegment = segments[segments.length - 1]
  if (!lastSegment) return 0

  const nextTrim = lastSegment.trim + lastSegment.length + 0.35
  if (sourceDurationCap == null) return nextTrim

  const maxTrimStart = Math.max(0, sourceDurationCap - 0.9)
  if (nextTrim <= maxTrimStart) return nextTrim

  const usedStarts = new Set(segments.map((segment) => Math.round(segment.trim * 10)))
  for (const candidate of [0, 1.25, 2.5, 4, 6, 8, 10, 14, 18, 24, 30]) {
    const bounded = Math.min(candidate, maxTrimStart)
    if (!usedStarts.has(Math.round(bounded * 10))) return bounded
  }

  return Math.max(0, maxTrimStart * 0.5)
}

function fillTimelineToTarget(
  segments: VideoSeg[],
  pacing: PacingProfile,
  sourceDurationCap: number | null
): void {
  let timelineCursor = segments.reduce((sum, segment) => sum + segment.length, 0)
  let segIndex = segments.length

  while (timelineCursor < pacing.renderSeconds - 0.2) {
    const jitterScale = segIndex % 3 === 0 ? 1.16 : segIndex % 3 === 1 ? 0.86 : 1.02
    const desiredLen = clamp(pacing.chunkSeconds * jitterScale, Math.max(0.9, pacing.chunkSeconds * 0.72), pacing.chunkSeconds * 1.28)
    const remainingTimeline = pacing.renderSeconds - timelineCursor
    const trim = nextFallbackTrim(segments, sourceDurationCap)
    const sourceRemaining =
      sourceDurationCap != null
        ? Math.max(0, sourceDurationCap - trim)
        : Number.POSITIVE_INFINITY
    const clipLen = Math.min(desiredLen, remainingTimeline, sourceRemaining)

    if (clipLen < 0.45) break

    segments.push({
      start: Number(timelineCursor.toFixed(2)),
      length: Number(clipLen.toFixed(2)),
      trim: Number(trim.toFixed(2)),
    })
    timelineCursor += clipLen
    segIndex += 1
  }
}

function cleanOverlayText(text: string | undefined, maxChars: number): string | null {
  if (!text) return null
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,!?'"#@:-]/g, '')
    .trim()
  if (cleaned.length < 3) return null
  return cleaned.slice(0, maxChars).trim()
}

function buildTextAsset(text: string, platform: TargetPlatform, type: 'subtitle' | 'callout'): Record<string, unknown> {
  const isSubtitle = type === 'subtitle'
  return {
    type: 'text',
    text,
    width: isSubtitle ? 960 : 820,
    height: isSubtitle ? 220 : 150,
    font: {
      family: 'Montserrat ExtraBold',
      color: '#ffffff',
      size: isSubtitle ? (platform === 'youtube' ? 32 : 36) : 40,
      weight: 700,
      lineHeight: 1.08,
    },
    alignment: { horizontal: 'center', vertical: 'center' },
    stroke: { width: 2, color: '#000000' },
    background: {
      color: '#000000',
      opacity: isSubtitle ? 0.34 : 0.48,
      padding: isSubtitle ? 8 : 10,
      borderRadius: 8,
    },
  }
}

function overlayY(position: TimedTextOverlay['position'], safeZone: SafeZoneOffsets): number {
  if (position === 'top') return 0.28
  if (position === 'middle') return 0.02
  return safeZone.captionY
}

function placementForSegment(segment: VideoSeg, offsetSeconds: number, renderSeconds: number): OverlayPlacement | null {
  const segmentEnd = Math.min(renderSeconds, segment.start + segment.length)
  if (segmentEnd - segment.start < 0.35) return null
  return {
    start: clamp(segment.start + offsetSeconds, segment.start, Math.max(segment.start, segmentEnd - 0.25)),
    maxEnd: segmentEnd,
    minStart: segment.start,
  }
}

function placementForTimelineStart(timelineStartSeconds: number, segments: VideoSeg[], renderSeconds: number): OverlayPlacement | null {
  if (timelineStartSeconds >= renderSeconds - 0.25) return null
  const start = clamp(timelineStartSeconds, 0, Math.max(0, renderSeconds - 0.25))
  const segment = segments.find((s) => start >= s.start && start < s.start + s.length)
  return {
    start,
    maxEnd: segment ? Math.min(renderSeconds, segment.start + segment.length) : renderSeconds,
    minStart: segment ? segment.start : 0,
  }
}

function mapSourceTimeToTimeline(sourceSecond: number, segments: VideoSeg[], renderSeconds: number): OverlayPlacement | null {
  for (const segment of segments) {
    const segmentSourceEnd = segment.trim + segment.length
    if (sourceSecond >= segment.trim && sourceSecond <= segmentSourceEnd) {
      return placementForSegment(segment, sourceSecond - segment.trim, renderSeconds)
    }
  }
  return null
}

function resolveOverlayPlacement(
  overlay: TimedTextOverlay,
  segments: VideoSeg[],
  renderSeconds: number
): OverlayPlacement | null {
  if (typeof overlay.sourceMomentIndex === 'number' && Number.isFinite(overlay.sourceMomentIndex)) {
    const index = Math.max(0, Math.floor(overlay.sourceMomentIndex))
    const segment = segments.find((s) => s.sourceMomentIndex === index) || segments[index]
    if (segment) {
      const offset = typeof overlay.offsetSeconds === 'number' && Number.isFinite(overlay.offsetSeconds)
        ? overlay.offsetSeconds
        : 0
      return placementForSegment(segment, offset, renderSeconds)
    }
  }

  const sourceStart = overlay.sourceStartSeconds
  if (typeof sourceStart === 'number' && Number.isFinite(sourceStart)) {
    return mapSourceTimeToTimeline(sourceStart, segments, renderSeconds)
  }

  if (typeof overlay.timelineStartSeconds === 'number' && Number.isFinite(overlay.timelineStartSeconds)) {
    if (overlay.timelineStartSeconds <= renderSeconds) {
      return placementForTimelineStart(overlay.timelineStartSeconds, segments, renderSeconds)
    }
    // If the model accidentally put a source timestamp here, map it instead of clamping it to the end.
    return mapSourceTimeToTimeline(overlay.timelineStartSeconds, segments, renderSeconds)
  }

  const start = overlay.startSeconds ?? overlay.start
  if (typeof start !== 'number' || !Number.isFinite(start)) return null
  if (start <= renderSeconds) {
    return placementForTimelineStart(start, segments, renderSeconds)
  }
  return mapSourceTimeToTimeline(start, segments, renderSeconds)
}

function buildTimedTextClips(params: {
  overlays?: TimedTextOverlay[]
  segments: VideoSeg[]
  platform: TargetPlatform
  safeZone: SafeZoneOffsets
  renderSeconds: number
  type: 'subtitle' | 'callout'
  maxItems: number
}): Array<Record<string, unknown>> {
  const clips: Array<Record<string, unknown>> = []
  for (const overlay of params.overlays || []) {
    if (clips.length >= params.maxItems) break
    const text = cleanOverlayText(overlay.text, params.type === 'subtitle' ? 84 : 54)
    const placement = resolveOverlayPlacement(overlay, params.segments, params.renderSeconds)
    if (!text || placement == null) continue
    const minReadableSeconds = params.type === 'subtitle' ? 1.25 : 1.6
    const rawLength = overlay.durationSeconds ?? overlay.length ?? (params.type === 'subtitle' ? 2.0 : 2.1)
    const length = clamp(rawLength, minReadableSeconds, params.type === 'subtitle' ? 3.2 : 3.0)
    let start = placement.start
    if (start >= params.renderSeconds - 0.25) continue
    const maxEnd = params.type === 'subtitle' ? params.renderSeconds : placement.maxEnd
    let availableSeconds = Math.min(params.renderSeconds, maxEnd) - start
    if (availableSeconds < minReadableSeconds) {
      start = Math.max(placement.minStart, Math.min(start, maxEnd - minReadableSeconds))
      availableSeconds = Math.min(params.renderSeconds, maxEnd) - start
    }
    if (availableSeconds < minReadableSeconds) continue
    clips.push({
      asset: buildTextAsset(text, params.platform, params.type),
      start: Number(start.toFixed(2)),
      length: Number(Math.min(length, availableSeconds).toFixed(2)),
      offset: {
        x: 0,
        y: overlayY(overlay.position || (params.type === 'subtitle' ? 'bottom' : 'top'), params.safeZone),
      },
      transition: { in: 'fadeFast', out: 'fadeFast' },
    })
  }
  return clips
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
  const segments: VideoSeg[] = buildSourceMomentSegments(
    editBlueprint?.sourceMoments,
    pacing,
    sourceDurationCap
  )
  fillTimelineToTarget(segments, { ...pacing, chunkSeconds: cutLen }, sourceDurationCap)

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
    if (landscapeMode === 'crop') {
      if (s.effect) {
        clip.effect = s.effect
      } else if (index === 0) {
        clip.effect = 'zoomInSlow'
      } else if (index === 2 && s.length >= 1.2) {
        clip.effect = 'zoomOutSlow'
      }
    }
    if (index === 0) {
      clip.transition = { in: 'fade' }
    }
    mainClips.push(clip)
  })

  const tracks: Array<{ clips: Array<Record<string, unknown>> }> = [{ clips: mainClips }]
  const calloutClips = buildTimedTextClips({
    overlays: editBlueprint?.textOverlays,
    segments,
    platform,
    safeZone,
    renderSeconds: pacing.renderSeconds,
    type: 'callout',
    maxItems: 3,
  })
  if (calloutClips.length) {
    tracks.push({ clips: calloutClips })
  }

  const subtitleClips = buildTimedTextClips({
    overlays: editBlueprint?.subtitles,
    segments,
    platform,
    safeZone,
    renderSeconds: pacing.renderSeconds,
    type: 'subtitle',
    maxItems: 16,
  })
  if (subtitleClips.length) {
    tracks.push({ clips: subtitleClips })
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
