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
    contentType?: ContentType
    layoutTemplate?: LayoutTemplate
    regions?: LayoutRegions
    richCaptionUrl?: string
    hookTitle?: string
    hookSubtitle?: string
    hookStyle?: 'pop' | 'glitch' | 'clean' | 'urgent'
    captionStyle?: 'karaoke' | 'bold' | 'clean'
    overlayTexts?: string[]
    preferredTransitions?: string[]
    sourceMoments?: SourceMoment[]
    textOverlays?: TimedTextOverlay[]
    subtitles?: TimedTextOverlay[]
    stickerOverlays?: StickerOverlay[]
    ctaOverlay?: TimedTextOverlay
    keywordHighlights?: string[]
  }
  /** Optional Deepgram (or compatible) word timings — when present, micro-cuts snap to speech/silence. */
  transcriptWords?: TranscriptWord[]
  /** Optional detected source duration in seconds from client metadata. */
  sourceDurationSeconds?: number
}

/** Minimal word timing shape (Deepgram-compatible). */
export type TranscriptWord = {
  start?: number
  end?: number
  word?: string
  punctuated_word?: string
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
  role?: SourceMomentRole
  focusRegion?: RegionRef
}

type ContentType = 'gameplayStream' | 'talkingHead' | 'sportsAction' | 'screenShare' | 'unknown'
type LayoutTemplate = 'auto' | 'fullFrame' | 'stackedFacecam' | 'pictureInPicture' | 'splitScreen' | 'focusCrop'
type RegionKey = 'gameplay' | 'facecam' | 'speaker' | 'action'
type SourceMomentRole = 'hook' | 'context' | 'escalation' | 'payoff' | 'proof' | 'loop'
type RegionRef = RegionKey | CropRegion

type CropRegion = {
  x?: number
  y?: number
  width?: number
  height?: number
  label?: string
  confidence?: number
}

type NormalizedCropRegion = Required<Pick<CropRegion, 'x' | 'y' | 'width' | 'height'>> &
  Pick<CropRegion, 'label' | 'confidence'>

type LayoutRegions = Partial<Record<RegionKey, CropRegion>>

type SourceMoment = {
  startSeconds?: number
  endSeconds?: number
  start?: number
  end?: number
  reason?: string
  visualTreatment?: 'none' | 'slowZoomIn' | 'slowZoomOut'
  role?: SourceMomentRole
  focusRegion?: RegionRef
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

type StickerOverlay = {
  text?: string
  label?: string
  timelineStartSeconds?: number
  sourceMomentIndex?: number
  offsetSeconds?: number
  durationSeconds?: number
  position?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'middleLeft' | 'middleRight'
}

type HookStyle = 'pop' | 'glitch' | 'clean' | 'urgent'
type CaptionStyle = 'karaoke' | 'bold' | 'clean'

type OverlayPlacement = {
  start: number
  maxEnd: number
  minStart: number
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** Shotstack Edit transition ids — only names we use elsewhere in this file (safe for API). */
function normalizeShotstackTransition(raw: string | undefined, fallback = 'fadeFast'): string {
  if (!raw || typeof raw !== 'string') return fallback
  const key = raw.trim().toLowerCase().replace(/[^a-z]/g, '')
  const map: Record<string, string> = {
    fade: 'fade',
    fadefast: 'fadeFast',
    slideup: 'slideUp',
    slidedown: 'slideDown',
    slideleft: 'slideLeft',
    slideright: 'slideRight',
    zoom: 'zoom',
    zoomfast: 'zoom',
    wipeleft: 'wipeLeft',
    wiperight: 'wipeRight',
    reveal: 'fadeFast',
    revealfast: 'fadeFast',
  }
  return map[key] || fallback
}

function defaultTransitionPalette(platform: TargetPlatform): string[] {
  if (platform === 'tiktok') return ['fade', 'fadeFast', 'slideUp', 'fadeFast']
  if (platform === 'reels') return ['fade', 'fadeFast', 'fadeFast', 'slideUp']
  return ['fade', 'fadeFast', 'fadeFast', 'fadeFast']
}

function videoClipTransition(params: {
  index: number
  clipCount: number
  preferred?: string[]
  platform: TargetPlatform
}): { in: string; out: string } {
  const palette = (params.preferred?.length
    ? params.preferred.map((p) => normalizeShotstackTransition(p))
    : defaultTransitionPalette(params.platform)) as string[]
  const safe = palette.length ? palette : defaultTransitionPalette(params.platform)
  const isLast = params.index >= params.clipCount - 1
  const inId =
    params.index === 0
      ? 'fade'
      : normalizeShotstackTransition(safe[params.index % safe.length])
  const outId = isLast ? 'fade' : normalizeShotstackTransition(safe[(params.index + 1) % safe.length])
  return { in: inId, out: outId }
}

/** Repeating cut transitions between video segments (StreamLadder / Opus-style rhythm). */
function streamLadderTransitionPattern(platform: TargetPlatform): string[] {
  if (platform === 'tiktok') {
    return ['fadeFast', 'slideUp', 'zoom', 'fadeFast', 'slideUp', 'fadeFast']
  }
  if (platform === 'reels') {
    return ['fade', 'fadeFast', 'slideUp', 'fadeFast', 'zoom', 'fadeFast']
  }
  return ['fade', 'fadeFast', 'slideUp', 'fadeFast', 'fadeFast', 'zoom']
}

function mergePreferredTransitionsList(platform: TargetPlatform, raw?: string[]): string[] {
  const pattern = streamLadderTransitionPattern(platform)
  const fromModel = (raw || []).map((s) => normalizeShotstackTransition(String(s).trim()))
  if (fromModel.length >= 4) return fromModel.slice(0, 8)
  return [...fromModel, ...pattern].slice(0, 8)
}

function streamLadderClampCutSeconds(platform: TargetPlatform, value: number): number {
  const softCap = platform === 'tiktok' ? 2.05 : platform === 'reels' ? 3.05 : 2.52
  return Math.min(value, softCap)
}

/**
 * StreamLadder / OpusClip-style defaults on every render (no UI preset).
 * Tightens slow model plans, fills transition patterns, hook zoom, and caption style.
 */
export function applyStreamLadderStyleBlueprint(
  platform: TargetPlatform,
  sourceDurationSeconds: number | undefined,
  input: GenerateShotstackInput['editBlueprint'] | undefined
): GenerateShotstackInput['editBlueprint'] | undefined {
  if (!input) return undefined
  const out: GenerateShotstackInput['editBlueprint'] = { ...input }
  out.preferredTransitions = mergePreferredTransitionsList(platform, input.preferredTransitions)
  if (typeof input.cutSeconds === 'number' && Number.isFinite(input.cutSeconds)) {
    out.cutSeconds = streamLadderClampCutSeconds(platform, input.cutSeconds)
  }
  if (typeof input.introHookSeconds === 'number' && Number.isFinite(input.introHookSeconds)) {
    const introCap = platform === 'tiktok' ? 2.5 : platform === 'reels' ? 3.25 : 2.75
    out.introHookSeconds = Math.min(input.introHookSeconds, introCap)
  }
  if (!input.captionStyle) {
    out.captionStyle = platform === 'tiktok' ? 'karaoke' : 'bold'
  }
  const src =
    typeof sourceDurationSeconds === 'number' && Number.isFinite(sourceDurationSeconds)
      ? sourceDurationSeconds
      : null
  if (src != null && src >= 18) {
    const r = input.renderSeconds
    if (r == null || !Number.isFinite(r) || r < 13) {
      out.renderSeconds = Math.min(45, Math.max(14, Math.round(Math.min(src * 0.36, 27))))
    } else if (r < 11 && src > 24) {
      out.renderSeconds = Math.min(45, Math.max(12, Math.round(Math.min(src * 0.34, 26))))
    }
  }
  if (input.sourceMoments?.length) {
    out.sourceMoments = input.sourceMoments.map((m) => ({ ...m }))
    const first = out.sourceMoments[0]!
    if (!first.visualTreatment || first.visualTreatment === 'none') {
      first.visualTreatment = 'slowZoomIn'
    }
    const peakIdx = out.sourceMoments.findIndex(
      (m, i) =>
        i > 0 && (m.role === 'payoff' || m.role === 'escalation' || m.role === 'proof')
    )
    if (peakIdx !== -1) {
      const peak = out.sourceMoments[peakIdx]!
      if (!peak.visualTreatment || peak.visualTreatment === 'none') {
        peak.visualTreatment = peak.role === 'payoff' ? 'slowZoomOut' : 'slowZoomIn'
      }
    }
  }
  return out
}

function resolvePacingProfile(platform: TargetPlatform, prompt?: string): PacingProfile {
  const p = (prompt || '').toLowerCase()
  // Baseline pacing matches StreamLadder / OpusClip-style jump cuts (not slow TV).
  const cinematicReels = platform === 'reels' && p.includes('cinematic')
  const chaosYt = platform === 'youtube' && (p.includes('fast') || p.includes('chaos'))
  if (platform === 'youtube') {
    if (chaosYt) return { chunkSeconds: 1.72, introHookSeconds: 1.85, renderSeconds: 28 }
    return { chunkSeconds: 1.98, introHookSeconds: 2, renderSeconds: 28 }
  }
  if (platform === 'reels') {
    if (cinematicReels) return { chunkSeconds: 3.35, introHookSeconds: 2.95, renderSeconds: 26 }
    return { chunkSeconds: 2.78, introHookSeconds: 2.45, renderSeconds: 28 }
  }
  // TikTok: dense micro-cuts.
  return { chunkSeconds: 1.26, introHookSeconds: 2.15, renderSeconds: 30 }
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

function normalizeLayoutTemplate(value: LayoutTemplate | undefined): LayoutTemplate {
  if (
    value === 'fullFrame' ||
    value === 'stackedFacecam' ||
    value === 'pictureInPicture' ||
    value === 'splitScreen' ||
    value === 'focusCrop'
  ) {
    return value
  }
  return 'auto'
}

function clampPct(value: number | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return clamp(value, 0, 1)
}

function normalizeRegion(region: CropRegion | undefined): NormalizedCropRegion | null {
  if (!region) return null
  const x = clampPct(region.x)
  const y = clampPct(region.y)
  const width = clampPct(region.width)
  const height = clampPct(region.height)
  if (x == null || y == null || width == null || height == null) return null
  if (width < 0.05 || height < 0.05) return null
  return {
    x,
    y,
    width: Math.min(width, 1 - x),
    height: Math.min(height, 1 - y),
    ...(region.label ? { label: region.label } : {}),
    ...(typeof region.confidence === 'number' ? { confidence: region.confidence } : {}),
  }
}

function resolveRegion(ref: RegionRef | undefined, regions: LayoutRegions | undefined): NormalizedCropRegion | null {
  if (!ref) return null
  if (typeof ref === 'string') return normalizeRegion(regions?.[ref])
  return normalizeRegion(ref)
}

function regionToShotstackCrop(region: CropRegion | null): Record<string, number> | undefined {
  const normalized = normalizeRegion(region || undefined)
  if (!normalized) return undefined
  return {
    top: Number(normalized.y.toFixed(4)),
    bottom: Number(Math.max(0, 1 - normalized.y - normalized.height).toFixed(4)),
    left: Number(normalized.x.toFixed(4)),
    right: Number(Math.max(0, 1 - normalized.x - normalized.width).toFixed(4)),
  }
}

function chooseAutoLayout(contentType: ContentType | undefined, regions: LayoutRegions | undefined): LayoutTemplate {
  const hasFacecam = Boolean(normalizeRegion(regions?.facecam))
  const hasGameplay = Boolean(normalizeRegion(regions?.gameplay))
  const hasAction = Boolean(normalizeRegion(regions?.action))
  const hasSpeaker = Boolean(normalizeRegion(regions?.speaker))

  if (contentType === 'gameplayStream' && hasFacecam && hasGameplay) return 'stackedFacecam'
  if (hasFacecam && hasGameplay) return 'pictureInPicture'
  if ((contentType === 'sportsAction' && hasAction) || hasSpeaker) return 'focusCrop'
  return 'fullFrame'
}

function resolveLayoutTemplate(
  requested: LayoutTemplate | undefined,
  contentType: ContentType | undefined,
  regions: LayoutRegions | undefined
): LayoutTemplate {
  const normalized = normalizeLayoutTemplate(requested)
  const template = normalized === 'auto' ? chooseAutoLayout(contentType, regions) : normalized
  const hasFacecam = Boolean(normalizeRegion(regions?.facecam))
  const hasGameplay = Boolean(normalizeRegion(regions?.gameplay))

  if ((template === 'stackedFacecam' || template === 'pictureInPicture' || template === 'splitScreen') && !hasFacecam) {
    return hasGameplay ? 'focusCrop' : 'fullFrame'
  }
  return template
}

const SPEECH_GAP_MIN = 0.34
const SPEECH_ALIGN_SLACK = 0.42
const SPEECH_MIN_CLIP = 0.48
const SPEECH_MAX_CLIP = 5.2

type TimedWord = { start: number; end: number }

function normalizeTimedWords(words: TranscriptWord[] | undefined): TimedWord[] {
  if (!words?.length) return []
  const out: TimedWord[] = []
  for (const w of words) {
    const s = typeof w.start === 'number' && Number.isFinite(w.start) ? w.start : null
    const e = typeof w.end === 'number' && Number.isFinite(w.end) ? w.end : null
    if (s == null || e == null || e <= s + 0.02) continue
    out.push({ start: s, end: e })
  }
  out.sort((a, b) => a.start - b.start)
  return out
}

/** If t lies inside a spoken word (not near edges), snap trim to that word's start. */
function snapSourceInsideWord(wds: TimedWord[], t: number, lo: number, hi: number): number {
  const clamped = clamp(t, lo, hi)
  const inside = wds.find((w) => clamped > w.start + 0.04 && clamped < w.end - 0.04)
  return inside ? Math.max(lo, inside.start) : clamped
}

/** Preferred source cut times: word ends and starts after breath-sized gaps. */
function compileSpeechCutCandidates(wds: TimedWord[]): number[] {
  const c = new Set<number>()
  for (const w of wds) {
    c.add(Number(w.end.toFixed(3)))
    c.add(Number(w.start.toFixed(3)))
  }
  for (let i = 1; i < wds.length; i++) {
    const gap = wds[i]!.start - wds[i - 1]!.end
    if (gap >= SPEECH_GAP_MIN) {
      c.add(Number(wds[i]!.start.toFixed(3)))
      c.add(Number(wds[i - 1]!.end.toFixed(3)))
    }
  }
  return Array.from(c).sort((a, b) => a - b)
}

function snapCutEndToWordBoundary(wds: TimedWord[], sourceStart: number, targetEnd: number, momentEnd: number): number {
  let e = clamp(targetEnd, sourceStart + SPEECH_MIN_CLIP, momentEnd)
  const interior = wds.find((w) => e > w.start + 0.03 && e < w.end - 0.03)
  if (interior) e = interior.end
  return clamp(e, sourceStart + SPEECH_MIN_CLIP, momentEnd)
}

function pickSpeechAlignedCutEnd(
  wds: TimedWord[],
  candidates: number[],
  sourceStart: number,
  idealEnd: number,
  momentEnd: number
): number {
  const minEnd = sourceStart + SPEECH_MIN_CLIP
  const maxEnd = Math.min(momentEnd, sourceStart + SPEECH_MAX_CLIP, idealEnd + SPEECH_ALIGN_SLACK)
  if (maxEnd < minEnd + 0.05) return clamp(idealEnd, minEnd, momentEnd)

  let best = clamp(idealEnd, minEnd, maxEnd)
  let bestScore = Infinity
  for (const cand of candidates) {
    if (cand < minEnd - 0.08 || cand > maxEnd + 0.08) continue
    const cc = clamp(cand, minEnd, maxEnd)
    const dist = Math.abs(cc - idealEnd)
    const bias = cc > idealEnd ? dist + 0.15 : dist
    if (bias < bestScore) {
      bestScore = bias
      best = cc
    }
  }
  return snapCutEndToWordBoundary(wds, sourceStart, best, momentEnd)
}

function normalizeSourceMoments(
  sourceMoments: SourceMoment[] | undefined,
  sourceDurationCap: number | null
): Array<{
  start: number
  end: number
  effect?: VideoSeg['effect']
  sourceMomentIndex: number
  role?: SourceMomentRole
  focusRegion?: RegionRef
}> {
  const maxEnd = sourceDurationCap ?? 90
  const moments: Array<{
    start: number
    end: number
    effect?: VideoSeg['effect']
    sourceMomentIndex: number
    role?: SourceMomentRole
    focusRegion?: RegionRef
  }> = []
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
    moments.push({
      start,
      end,
      ...(effect ? { effect } : {}),
      sourceMomentIndex,
      ...(moment.role ? { role: moment.role } : {}),
      ...(moment.focusRegion ? { focusRegion: moment.focusRegion } : {}),
    })
    if (moments.length >= 12) break
  }
  return moments
}

function buildSourceMomentSegments(
  sourceMoments: SourceMoment[] | undefined,
  pacing: PacingProfile,
  sourceDurationCap: number | null,
  transcriptWords?: TranscriptWord[]
): VideoSeg[] {
  const moments = normalizeSourceMoments(sourceMoments, sourceDurationCap)
  if (!moments.length) return []

  const wds = normalizeTimedWords(transcriptWords)
  const candidates = wds.length >= 3 ? compileSpeechCutCandidates(wds) : []
  const useSpeech = wds.length >= 3

  const cutLen = pacing.chunkSeconds
  const segments: VideoSeg[] = []
  let timelineCursor = 0
  let segIndex = 0

  for (const moment of moments) {
    let sourceCursor = moment.start
    let isFirstSegOfMoment = true
    if (useSpeech) {
      sourceCursor = snapSourceInsideWord(wds, sourceCursor, moment.start, moment.end)
    }
    while (sourceCursor < moment.end - 0.3 && timelineCursor < pacing.renderSeconds - 0.2) {
      const jitterScale = segIndex % 3 === 0 ? 1.16 : segIndex % 3 === 1 ? 0.86 : 1.02
      const desiredLen = clamp(cutLen * jitterScale, Math.max(0.9, cutLen * 0.72), cutLen * 1.28)

      let clipLen: number
      if (useSpeech) {
        const idealEnd = Math.min(sourceCursor + desiredLen, moment.end)
        const clipEnd = pickSpeechAlignedCutEnd(wds, candidates, sourceCursor, idealEnd, moment.end)
        clipLen = Math.min(clipEnd - sourceCursor, pacing.renderSeconds - timelineCursor, moment.end - sourceCursor)
      } else {
        clipLen = Math.min(desiredLen, moment.end - sourceCursor, pacing.renderSeconds - timelineCursor)
      }

      if (clipLen < 0.45) break
      segments.push({
        start: Number(timelineCursor.toFixed(2)),
        length: Number(clipLen.toFixed(2)),
        trim: Number(sourceCursor.toFixed(2)),
        sourceMomentIndex: moment.sourceMomentIndex,
        effect: isFirstSegOfMoment ? moment.effect : undefined,
        role: moment.role,
        focusRegion: moment.focusRegion,
      })
      timelineCursor += clipLen
      if (useSpeech) {
        sourceCursor = Number((sourceCursor + clipLen).toFixed(3))
        sourceCursor = snapSourceInsideWord(wds, sourceCursor, moment.start, moment.end)
        if (clipLen < SPEECH_MIN_CLIP - 0.02) break
      } else {
        sourceCursor += clipLen * (segIndex % 2 === 0 ? 1.02 : 0.94)
      }
      isFirstSegOfMoment = false
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
  sourceDurationCap: number | null,
  transcriptWords?: TranscriptWord[]
): void {
  const wds = normalizeTimedWords(transcriptWords)
  const candidates = wds.length >= 3 ? compileSpeechCutCandidates(wds) : []
  const useSpeech = wds.length >= 3 && sourceDurationCap != null

  let timelineCursor = segments.reduce((sum, segment) => sum + segment.length, 0)
  let segIndex = segments.length

  while (timelineCursor < pacing.renderSeconds - 0.2) {
    const jitterScale = segIndex % 3 === 0 ? 1.16 : segIndex % 3 === 1 ? 0.86 : 1.02
    const desiredLen = clamp(pacing.chunkSeconds * jitterScale, Math.max(0.9, pacing.chunkSeconds * 0.72), pacing.chunkSeconds * 1.28)
    const remainingTimeline = pacing.renderSeconds - timelineCursor
    let trim = nextFallbackTrim(segments, sourceDurationCap)

    let clipLen: number
    if (useSpeech) {
      const cap = sourceDurationCap!
      trim = snapSourceInsideWord(wds, trim, 0, cap)
      const idealEnd = trim + desiredLen
      const clipEnd = pickSpeechAlignedCutEnd(wds, candidates, trim, Math.min(idealEnd, cap), cap)
      clipLen = Math.min(clipEnd - trim, remainingTimeline, Math.max(0, cap - trim))
    } else {
      const sourceRemaining =
        sourceDurationCap != null
          ? Math.max(0, sourceDurationCap - trim)
          : Number.POSITIVE_INFINITY
      clipLen = Math.min(desiredLen, remainingTimeline, sourceRemaining)
    }

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

function cleanDecorativeText(text: string | undefined, maxChars: number): string | null {
  if (!text) return null
  const cleaned = text.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
  if (cleaned.length < 1) return null
  return cleaned.slice(0, maxChars).trim()
}

function buildHookTextAsset(
  text: string,
  platform: TargetPlatform,
  style: HookStyle | undefined,
  isSubtitle = false
): Record<string, unknown> {
  const urgent = style === 'urgent' || platform === 'tiktok'
  return {
    type: 'text',
    text,
    width: isSubtitle ? 860 : 940,
    height: isSubtitle ? 120 : 210,
    font: {
      family: 'Montserrat ExtraBold',
      color: urgent ? '#fff200' : '#ffffff',
      size: isSubtitle ? 34 : 58,
      weight: 800,
      lineHeight: 1.02,
    },
    alignment: { horizontal: 'center', vertical: 'center' },
    stroke: { width: urgent ? 4 : 3, color: '#000000' },
    background: {
      color: urgent ? '#ff2d55' : '#06111f',
      opacity: isSubtitle ? 0.58 : 0.72,
      padding: isSubtitle ? 8 : 12,
      borderRadius: 12,
    },
  }
}

function buildTextAsset(
  text: string,
  platform: TargetPlatform,
  type: 'subtitle' | 'callout',
  captionStyle?: CaptionStyle
): Record<string, unknown> {
  const isSubtitle = type === 'subtitle'
  const isKaraoke = isSubtitle && captionStyle === 'karaoke'
  const isClean = isSubtitle && captionStyle === 'clean'
  return {
    type: 'text',
    text,
    width: isSubtitle ? 960 : 820,
    height: isSubtitle ? 220 : 150,
    font: {
      family: 'Montserrat ExtraBold',
      color: isKaraoke ? '#fff200' : '#ffffff',
      size: isSubtitle ? (platform === 'youtube' ? 34 : 40) : 42,
      weight: 700,
      lineHeight: 1.08,
    },
    alignment: { horizontal: 'center', vertical: 'center' },
    stroke: { width: 2, color: '#000000' },
    background: {
      color: '#000000',
      opacity: isClean ? 0.18 : isSubtitle ? 0.42 : 0.58,
      padding: isSubtitle ? 9 : 11,
      borderRadius: 8,
    },
  }
}

function overlayY(position: TimedTextOverlay['position'], safeZone: SafeZoneOffsets): number {
  if (position === 'top') return 0.28
  if (position === 'middle') return 0.02
  return safeZone.captionY
}

function stickerOffset(position: StickerOverlay['position']): { x: number; y: number } {
  switch (position) {
    case 'topLeft':
      return { x: -0.31, y: 0.31 }
    case 'topRight':
      return { x: 0.31, y: 0.31 }
    case 'bottomLeft':
      return { x: -0.31, y: -0.18 }
    case 'bottomRight':
      return { x: 0.31, y: -0.18 }
    case 'middleLeft':
      return { x: -0.34, y: 0.02 }
    case 'middleRight':
      return { x: 0.34, y: 0.02 }
    default:
      return { x: 0.31, y: 0.31 }
  }
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
  captionStyle?: CaptionStyle
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
    const calloutIn = (['zoom', 'slideUp', 'fadeFast'] as const)[clips.length % 3]
    clips.push({
      asset: buildTextAsset(text, params.platform, params.type, params.captionStyle),
      start: Number(start.toFixed(2)),
      length: Number(Math.min(length, availableSeconds).toFixed(2)),
      offset: {
        x: 0,
        y: overlayY(overlay.position || (params.type === 'subtitle' ? 'bottom' : 'top'), params.safeZone),
      },
      transition:
        params.type === 'callout'
          ? { in: calloutIn, out: 'fadeFast' }
          : { in: 'fadeFast', out: 'fadeFast' },
    })
  }
  return clips
}

function buildHookClips(params: {
  hookTitle?: string
  hookSubtitle?: string
  hookStyle?: HookStyle
  platform: TargetPlatform
  renderSeconds: number
}): Array<Record<string, unknown>> {
  const title = cleanDecorativeText(params.hookTitle, 62)
  if (!title) return []
  const duration = Math.min(1.82, Math.max(1.32, params.renderSeconds * 0.12))
  const clips: Array<Record<string, unknown>> = [
    {
      asset: buildHookTextAsset(title.toUpperCase(), params.platform, params.hookStyle),
      start: 0,
      length: Number(duration.toFixed(2)),
      offset: { x: 0, y: 0.29 },
      transition: { in: 'slideUp', out: 'fadeFast' },
    },
  ]
  const subtitle = cleanDecorativeText(params.hookSubtitle, 84)
  if (subtitle) {
    clips.push({
      asset: buildHookTextAsset(subtitle, params.platform, params.hookStyle, true),
      start: 0.12,
      length: Number(Math.max(1.35, duration - 0.12).toFixed(2)),
      offset: { x: 0, y: 0.14 },
      transition: { in: 'fadeFast', out: 'fadeFast' },
    })
  }
  return clips
}

function buildStickerClips(params: {
  stickers?: StickerOverlay[]
  segments: VideoSeg[]
  platform: TargetPlatform
  renderSeconds: number
}): Array<Record<string, unknown>> {
  const clips: Array<Record<string, unknown>> = []
  for (const sticker of params.stickers || []) {
    if (clips.length >= 6) break
    const text = cleanDecorativeText(sticker.text || sticker.label, 22)
    if (!text) continue
    const placement = resolveOverlayPlacement(
      {
        timelineStartSeconds: sticker.timelineStartSeconds,
        sourceMomentIndex: sticker.sourceMomentIndex,
        offsetSeconds: sticker.offsetSeconds,
        durationSeconds: sticker.durationSeconds,
      },
      params.segments,
      params.renderSeconds
    )
    if (!placement) continue
    const start = placement.start
    if (start >= params.renderSeconds - 0.4) continue
    const length = Math.min(
      clamp(sticker.durationSeconds ?? 1.45, 0.9, 2.4),
      params.renderSeconds - start
    )
    clips.push({
      asset: {
        type: 'text',
        text,
        width: 270,
        height: 110,
        font: {
          family: 'Montserrat ExtraBold',
          color: '#ffffff',
          size: 42,
          weight: 800,
        },
        alignment: { horizontal: 'center', vertical: 'center' },
        stroke: { width: 3, color: '#000000' },
        background: {
          color: '#ff2d55',
          opacity: 0.62,
          padding: 8,
          borderRadius: 18,
        },
      },
      start: Number(start.toFixed(2)),
      length: Number(length.toFixed(2)),
      offset: stickerOffset(sticker.position),
      transition: { in: 'zoom', out: 'fadeFast' },
    })
  }
  return clips
}

function buildCtaClips(params: {
  cta?: TimedTextOverlay
  platform: TargetPlatform
  renderSeconds: number
  safeZone: SafeZoneOffsets
}): Array<Record<string, unknown>> {
  const text = cleanDecorativeText(params.cta?.text, 70)
  if (!text || params.renderSeconds < 5) return []
  const length = clamp(params.cta?.durationSeconds ?? 1.8, 1.2, 2.5)
  const start = Math.max(0, params.renderSeconds - length - 0.08)
  return [
    {
      asset: buildTextAsset(text.toUpperCase(), params.platform, 'callout'),
      start: Number(start.toFixed(2)),
      length: Number(Math.min(length, params.renderSeconds - start).toFixed(2)),
      offset: {
        x: 0,
        y: overlayY(params.cta?.position || 'middle', params.safeZone),
      },
      transition: { in: 'slideUp', out: 'fade' },
    },
  ]
}

function clipWithVideoAsset(params: {
  sourceUrl: string
  segment: VideoSeg
  landscapeMode: 'crop' | 'letterbox'
  index: number
  clipCount: number
  preferredTransitions?: string[]
  platform: TargetPlatform
  crop?: Record<string, number>
  width?: number
  height?: number
  position?: string
  offset?: { x: number; y: number }
  fit?: 'crop' | 'contain'
}): Record<string, unknown> {
  const asset: Record<string, unknown> = {
    type: 'video',
    src: params.sourceUrl,
    trim: params.segment.trim,
    transcode: true,
  }
  // Crop belongs on VideoAsset, not on Clip (Shotstack Edit API validation).
  if (params.crop) asset.crop = params.crop

  const clip: Record<string, unknown> = {
    asset,
    start: params.segment.start,
    length: params.segment.length,
    fit: params.fit || (params.landscapeMode === 'letterbox' ? 'contain' : 'crop'),
    position: params.position || 'center',
  }
  if (params.width) clip.width = params.width
  if (params.height) clip.height = params.height
  if (params.offset) clip.offset = params.offset

  if (params.landscapeMode === 'crop') {
    if (params.segment.effect) {
      clip.effect = params.segment.effect
    } else if (params.index === 0) {
      clip.effect = 'zoomInSlow'
    } else if (params.index === 2 && params.segment.length >= 1.2) {
      clip.effect = 'zoomOutSlow'
    }
  }
  clip.transition = videoClipTransition({
    index: params.index,
    clipCount: Math.max(1, params.clipCount),
    preferred: params.preferredTransitions,
    platform: params.platform,
  })
  return clip
}

function regionCropByKey(regions: LayoutRegions | undefined, key: RegionKey): Record<string, number> | undefined {
  return regionToShotstackCrop(normalizeRegion(regions?.[key]))
}

function focusCropForSegment(segment: VideoSeg, regions: LayoutRegions | undefined): Record<string, number> | undefined {
  const preferred = resolveRegion(segment.focusRegion, regions)
  const roleFallback =
    segment.role === 'payoff' || segment.role === 'proof'
      ? normalizeRegion(regions?.action)
      : segment.role === 'hook'
        ? normalizeRegion(regions?.action) || normalizeRegion(regions?.speaker)
        : null
  return regionToShotstackCrop(preferred || roleFallback || normalizeRegion(regions?.action) || normalizeRegion(regions?.speaker))
}

function buildFullFrameTrack(params: {
  sourceUrl: string
  segments: VideoSeg[]
  landscapeMode: 'crop' | 'letterbox'
  regions?: LayoutRegions
  focus?: boolean
  preferredTransitions?: string[]
  platform: TargetPlatform
}): { clips: Array<Record<string, unknown>> } {
  const n = params.segments.length
  return {
    clips: params.segments.map((segment, index) =>
      clipWithVideoAsset({
        sourceUrl: params.sourceUrl,
        segment,
        landscapeMode: params.landscapeMode,
        index,
        clipCount: n,
        preferredTransitions: params.preferredTransitions,
        platform: params.platform,
        crop: params.focus ? focusCropForSegment(segment, params.regions) : undefined,
      })
    ),
  }
}

function buildStackedTracks(params: {
  sourceUrl: string
  segments: VideoSeg[]
  landscapeMode: 'crop' | 'letterbox'
  regions?: LayoutRegions
  preferredTransitions?: string[]
  platform: TargetPlatform
}): Array<{ clips: Array<Record<string, unknown>> }> {
  const gameplayCrop = regionCropByKey(params.regions, 'gameplay')
  const facecamCrop = regionCropByKey(params.regions, 'facecam')
  if (!facecamCrop) {
    return [buildFullFrameTrack({ ...params, focus: Boolean(gameplayCrop) })]
  }

  const n = params.segments.length
  const gameplayClips = params.segments.map((segment, index) =>
    clipWithVideoAsset({
      sourceUrl: params.sourceUrl,
      segment,
      landscapeMode: params.landscapeMode,
      index,
      clipCount: n,
      preferredTransitions: params.preferredTransitions,
      platform: params.platform,
      crop: gameplayCrop,
      width: 1080,
      height: 1220,
      position: 'bottom',
      offset: { x: 0, y: 0.02 },
      fit: 'crop',
    })
  )
  const facecamClips = params.segments.map((segment, index) =>
    clipWithVideoAsset({
      sourceUrl: params.sourceUrl,
      segment,
      landscapeMode: 'crop',
      index,
      clipCount: n,
      preferredTransitions: params.preferredTransitions,
      platform: params.platform,
      crop: facecamCrop,
      width: 1080,
      height: 650,
      position: 'top',
      offset: { x: 0, y: -0.02 },
      fit: 'crop',
    })
  )

  return [{ clips: gameplayClips }, { clips: facecamClips }]
}

function buildPictureInPictureTracks(params: {
  sourceUrl: string
  segments: VideoSeg[]
  landscapeMode: 'crop' | 'letterbox'
  regions?: LayoutRegions
  preferredTransitions?: string[]
  platform: TargetPlatform
}): Array<{ clips: Array<Record<string, unknown>> }> {
  const facecamCrop = regionCropByKey(params.regions, 'facecam')
  if (!facecamCrop) return [buildFullFrameTrack({ ...params, focus: true })]

  const gameplayCrop = regionCropByKey(params.regions, 'gameplay')
  const n = params.segments.length
  const baseTrack = buildFullFrameTrack({
    ...params,
    focus: Boolean(gameplayCrop || params.regions?.action),
  })
  if (gameplayCrop) {
    baseTrack.clips = params.segments.map((segment, index) =>
      clipWithVideoAsset({
        sourceUrl: params.sourceUrl,
        segment,
        landscapeMode: params.landscapeMode,
        index,
        clipCount: n,
        preferredTransitions: params.preferredTransitions,
        platform: params.platform,
        crop: gameplayCrop,
      })
    )
  }

  const facecamClips = params.segments.map((segment, index) =>
    clipWithVideoAsset({
      sourceUrl: params.sourceUrl,
      segment,
      landscapeMode: 'crop',
      index,
      clipCount: n,
      preferredTransitions: params.preferredTransitions,
      platform: params.platform,
      crop: facecamCrop,
      width: 360,
      height: 360,
      position: 'topRight',
      offset: { x: -0.06, y: -0.08 },
      fit: 'crop',
    })
  )

  return [baseTrack, { clips: facecamClips }]
}

function buildSplitScreenTracks(params: {
  sourceUrl: string
  segments: VideoSeg[]
  landscapeMode: 'crop' | 'letterbox'
  regions?: LayoutRegions
  preferredTransitions?: string[]
  platform: TargetPlatform
}): Array<{ clips: Array<Record<string, unknown>> }> {
  const gameplayCrop = regionCropByKey(params.regions, 'gameplay')
  const facecamCrop = regionCropByKey(params.regions, 'facecam')
  if (!facecamCrop) return [buildFullFrameTrack({ ...params, focus: Boolean(gameplayCrop) })]

  const n = params.segments.length
  const topClips = params.segments.map((segment, index) =>
    clipWithVideoAsset({
      sourceUrl: params.sourceUrl,
      segment,
      landscapeMode: 'crop',
      index,
      clipCount: n,
      preferredTransitions: params.preferredTransitions,
      platform: params.platform,
      crop: facecamCrop,
      width: 1080,
      height: 960,
      position: 'top',
      fit: 'crop',
    })
  )
  const bottomClips = params.segments.map((segment, index) =>
    clipWithVideoAsset({
      sourceUrl: params.sourceUrl,
      segment,
      landscapeMode: params.landscapeMode,
      index,
      clipCount: n,
      preferredTransitions: params.preferredTransitions,
      platform: params.platform,
      crop: gameplayCrop,
      width: 1080,
      height: 960,
      position: 'bottom',
      fit: 'crop',
    })
  )

  return [{ clips: bottomClips }, { clips: topClips }]
}

function buildVideoTracks(params: {
  sourceUrl: string
  segments: VideoSeg[]
  landscapeMode: 'crop' | 'letterbox'
  layoutTemplate: LayoutTemplate
  regions?: LayoutRegions
  preferredTransitions?: string[]
  platform: TargetPlatform
}): Array<{ clips: Array<Record<string, unknown>> }> {
  switch (params.layoutTemplate) {
    case 'stackedFacecam':
      return buildStackedTracks(params)
    case 'pictureInPicture':
      return buildPictureInPictureTracks(params)
    case 'splitScreen':
      return buildSplitScreenTracks(params)
    case 'focusCrop':
      return [buildFullFrameTrack({ ...params, focus: true })]
    case 'fullFrame':
    default:
      return [buildFullFrameTrack(params)]
  }
}

function buildRichCaptionClips(params: {
  richCaptionUrl?: string
  platform: TargetPlatform
  renderSeconds: number
  safeZone: SafeZoneOffsets
  captionStyle?: CaptionStyle
}): Array<Record<string, unknown>> {
  if (!params.richCaptionUrl || !/^https?:\/\//i.test(params.richCaptionUrl)) return []
  const animationStyle =
    params.captionStyle === 'clean' ? 'highlight' : params.captionStyle === 'bold' ? 'pop' : 'karaoke'
  return [
    {
      asset: {
        type: 'rich-caption',
        src: params.richCaptionUrl,
        font: {
          family: 'Montserrat ExtraBold',
          size: params.platform === 'youtube' ? 50 : 56,
          color: '#ffffff',
          weight: 800,
        },
        background: {
          color: '#000000',
          opacity: 0.52,
          borderRadius: 14,
          wrap: true,
        },
        padding: 10,
        align: { horizontal: 'center', vertical: 'middle' },
        stroke: { width: 4, color: '#000000', opacity: 1 },
        animation: { style: animationStyle },
        active: {
          font: {
            color: params.captionStyle === 'clean' ? '#ffffff' : '#fff200',
          },
          stroke: { width: 4, color: '#000000', opacity: 1 },
        },
        style: { textTransform: 'uppercase' },
      },
      start: 0,
      length: Number(params.renderSeconds.toFixed(2)),
      width: 900,
      height: 260,
      offset: {
        x: 0,
        y: params.safeZone.captionY,
      },
    },
  ]
}

export function generateShotstackJSON({
  title = 'Viral Architect Output',
  sourceUrl,
  platform,
  captionText,
  safeZone,
  shotstackEditPrompt,
  hookPlan,
  landscapeMode = 'crop',
  editBlueprint,
  transcriptWords,
  sourceDurationSeconds,
}: GenerateShotstackInput) {
  const blueprint =
    editBlueprint != null
      ? applyStreamLadderStyleBlueprint(platform, sourceDurationSeconds, editBlueprint) ?? editBlueprint
      : undefined
  const pacingBase = resolvePacingProfile(platform, shotstackEditPrompt)
  const requestedRenderSeconds = clamp(blueprint?.renderSeconds ?? pacingBase.renderSeconds, 8.0, 45.0)
  const sourceDurationCap =
    typeof sourceDurationSeconds === 'number' && Number.isFinite(sourceDurationSeconds)
      ? clamp(sourceDurationSeconds - 0.2, 2.5, 90)
      : null
  const pacing: PacingProfile = {
    chunkSeconds: clamp(blueprint?.cutSeconds ?? pacingBase.chunkSeconds, 1.0, 4.5),
    introHookSeconds: clamp(blueprint?.introHookSeconds ?? pacingBase.introHookSeconds, 1.0, 5.0),
    renderSeconds:
      sourceDurationCap != null
        ? Math.min(requestedRenderSeconds, sourceDurationCap)
        : requestedRenderSeconds,
  }
  const cutLen = pacing.chunkSeconds
  const segments: VideoSeg[] = buildSourceMomentSegments(
    blueprint?.sourceMoments,
    pacing,
    sourceDurationCap,
    transcriptWords
  )
  fillTimelineToTarget(segments, { ...pacing, chunkSeconds: cutLen }, sourceDurationCap, transcriptWords)
  const layoutTemplate = resolveLayoutTemplate(
    blueprint?.layoutTemplate,
    blueprint?.contentType,
    blueprint?.regions
  )
  const tracks: Array<{ clips: Array<Record<string, unknown>> }> = buildVideoTracks({
    sourceUrl,
    segments,
    landscapeMode,
    layoutTemplate,
    regions: blueprint?.regions,
    preferredTransitions: blueprint?.preferredTransitions,
    platform,
  })
  const hookClips = buildHookClips({
    hookTitle: blueprint?.hookTitle || captionText || hookPlan,
    hookSubtitle: blueprint?.hookSubtitle,
    hookStyle: blueprint?.hookStyle,
    platform,
    renderSeconds: pacing.renderSeconds,
  })
  if (hookClips.length) {
    tracks.push({ clips: hookClips })
  }

  const calloutClips = buildTimedTextClips({
    overlays: blueprint?.textOverlays,
    segments,
    platform,
    safeZone,
    renderSeconds: pacing.renderSeconds,
    type: 'callout',
    maxItems: 8,
  })
  if (calloutClips.length) {
    tracks.push({ clips: calloutClips })
  }

  const stickerClips = buildStickerClips({
    stickers: blueprint?.stickerOverlays,
    segments,
    platform,
    renderSeconds: pacing.renderSeconds,
  })
  if (stickerClips.length) {
    tracks.push({ clips: stickerClips })
  }

  const richCaptionClips = buildRichCaptionClips({
    richCaptionUrl: blueprint?.richCaptionUrl,
    platform,
    safeZone,
    renderSeconds: pacing.renderSeconds,
    captionStyle: blueprint?.captionStyle,
  })
  if (richCaptionClips.length) {
    tracks.push({ clips: richCaptionClips })
  }

  const subtitleClips = buildTimedTextClips({
    overlays: richCaptionClips.length ? [] : blueprint?.subtitles,
    segments,
    platform,
    safeZone,
    renderSeconds: pacing.renderSeconds,
    type: 'subtitle',
    maxItems: 16,
    captionStyle: blueprint?.captionStyle,
  })
  if (subtitleClips.length) {
    tracks.push({ clips: subtitleClips })
  }

  const ctaClips = buildCtaClips({
    cta: blueprint?.ctaOverlay,
    platform,
    renderSeconds: pacing.renderSeconds,
    safeZone,
  })
  if (ctaClips.length) {
    tracks.push({ clips: ctaClips })
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
        layoutTemplate,
        resolvedSegments: segments,
      visualPackage: {
        hook: Boolean(hookClips.length),
        callouts: calloutClips.length,
        stickers: stickerClips.length,
          subtitles: richCaptionClips.length || subtitleClips.length,
          richCaptions: Boolean(richCaptionClips.length),
        cta: Boolean(ctaClips.length),
        captionStyle: blueprint?.captionStyle || null,
        keywordHighlights: blueprint?.keywordHighlights || [],
      },
      ...(shotstackEditPrompt
        ? {
            aiShotstackEditPrompt: shotstackEditPrompt,
          }
        : {}),
    },
  }
}
