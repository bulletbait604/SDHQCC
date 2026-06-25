import { geminiVideoPlanSchema, viralSegmentSchema } from '@/lib/clip-editor/schemas'
import type { GeminiVideoPlan } from '@/lib/clip-editor/types'
import { z } from 'zod'

const CAPTION_STYLES = ['karaoke', 'bold', 'clean'] as const
const HOOK_STYLES = ['pop', 'glitch', 'clean', 'urgent'] as const
const CONTENT_TYPES = ['gameplayStream', 'talkingHead', 'sportsAction', 'screenShare', 'unknown'] as const
const LAYOUT_TEMPLATES = [
  'auto',
  'fullFrame',
  'stackedFacecam',
  'pictureInPicture',
  'splitScreen',
  'focusCrop',
] as const

type CaptionStyle = (typeof CAPTION_STYLES)[number]
type HookStyle = (typeof HOOK_STYLES)[number]
type ContentType = (typeof CONTENT_TYPES)[number]
type LayoutTemplate = (typeof LAYOUT_TEMPLATES)[number]

function asLowerString(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isCaptionStyle(value: string): value is CaptionStyle {
  return (CAPTION_STYLES as readonly string[]).includes(value)
}

function isHookStyle(value: string): value is HookStyle {
  return (HOOK_STYLES as readonly string[]).includes(value)
}

function isContentType(value: string): value is ContentType {
  return (CONTENT_TYPES as readonly string[]).includes(value)
}

function isLayoutTemplate(value: string): value is LayoutTemplate {
  return (LAYOUT_TEMPLATES as readonly string[]).includes(value)
}

/** Gemini often swaps hookStyle ↔ captionStyle (e.g. urgent on captions). */
export function normalizeCaptionStyle(value: unknown): CaptionStyle | undefined {
  const s = asLowerString(value)
  if (!s) return undefined
  if (isCaptionStyle(s)) return s
  if (isHookStyle(s)) {
    if (s === 'urgent' || s === 'pop') return 'bold'
    if (s === 'glitch') return 'karaoke'
    return 'clean'
  }
  if (s.includes('karaoke') || s.includes('word')) return 'karaoke'
  if (s.includes('bold') || s.includes('urgent') || s.includes('pop')) return 'bold'
  return 'bold'
}

export function normalizeHookStyle(value: unknown): HookStyle | undefined {
  const s = asLowerString(value)
  if (!s) return undefined
  if (isHookStyle(s)) return s
  if (isCaptionStyle(s)) {
    if (s === 'karaoke') return 'pop'
    if (s === 'bold') return 'urgent'
    return 'clean'
  }
  if (s.includes('glitch')) return 'glitch'
  if (s.includes('urgent')) return 'urgent'
  return 'clean'
}

function normalizeContentType(value: unknown): ContentType | undefined {
  const s = asLowerString(value)
  if (!s) return undefined
  if (isContentType(s)) return s
  if (s.includes('game') || s.includes('stream')) return 'gameplayStream'
  if (s.includes('talk') || s.includes('podcast') || s.includes('head')) return 'talkingHead'
  if (s.includes('sport') || s.includes('action')) return 'sportsAction'
  if (s.includes('screen') || s.includes('share')) return 'screenShare'
  return 'unknown'
}

function normalizeLayoutTemplate(value: unknown): LayoutTemplate | undefined {
  const s = asLowerString(value)
  if (!s) return undefined
  if (isLayoutTemplate(s)) return s
  if (s.includes('stack')) return 'stackedFacecam'
  if (s.includes('pip') || s.includes('picture')) return 'pictureInPicture'
  if (s.includes('split')) return 'splitScreen'
  if (s.includes('focus') || s.includes('crop')) return 'focusCrop'
  if (s.includes('full')) return 'fullFrame'
  return 'auto'
}

function normalizeEnumFields(o: Record<string, unknown>): void {
  const captionRaw = o.captionStyle
  const hookRaw = o.hookStyle
  const captionFromCaption = normalizeCaptionStyle(captionRaw)
  const hookFromHook = normalizeHookStyle(hookRaw)
  const captionFromHook = normalizeCaptionStyle(hookRaw)
  const hookFromCaption = normalizeHookStyle(captionRaw)

  const captionLooksLikeHook =
    typeof captionRaw === 'string' && isHookStyle(asLowerString(captionRaw)) && !isCaptionStyle(asLowerString(captionRaw))
  const hookLooksLikeCaption =
    typeof hookRaw === 'string' && isCaptionStyle(asLowerString(hookRaw)) && !isHookStyle(asLowerString(hookRaw))

  if (captionLooksLikeHook && hookLooksLikeCaption) {
    o.captionStyle = captionFromHook
    o.hookStyle = hookFromCaption
  } else {
    if (captionFromCaption) o.captionStyle = captionFromCaption
    else if (captionRaw !== undefined) delete o.captionStyle

    if (hookFromHook) o.hookStyle = hookFromHook
    else if (hookRaw !== undefined) delete o.hookStyle
  }

  const contentType = normalizeContentType(o.contentType)
  if (contentType) o.contentType = contentType
  else if (o.contentType !== undefined) o.contentType = 'unknown'

  const layout = normalizeLayoutTemplate(o.layoutTemplate)
  if (layout) o.layoutTemplate = layout
  else if (o.layoutTemplate !== undefined) o.layoutTemplate = 'auto'
}

function clampSegmentWindow(
  start: number,
  end: number,
  duration: number
): { start: number; end: number } {
  let s = Math.max(0, Math.min(start, duration - 1))
  let e = Math.max(s + 5, Math.min(end, duration))
  if (e - s > 45) e = s + 45
  return { start: Number(s.toFixed(2)), end: Number(e.toFixed(2)) }
}

function normalizeViralSegmentsRaw(raw: unknown, durationSeconds: number): z.infer<typeof viralSegmentSchema>[] {
  if (!Array.isArray(raw)) return []
  const duration = Math.max(1, durationSeconds)
  const out: z.infer<typeof viralSegmentSchema>[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const startRaw =
      typeof row.start === 'number'
        ? row.start
        : typeof row.start_time === 'number'
          ? row.start_time
          : null
    const endRaw =
      typeof row.end === 'number'
        ? row.end
        : typeof row.end_time === 'number'
          ? row.end_time
          : null
    if (startRaw == null || endRaw == null) continue

    const { start, end } = clampSegmentWindow(startRaw, endRaw, duration)
    const title =
      typeof row.title === 'string' && row.title.trim()
        ? row.title.trim().slice(0, 80)
        : 'Highlight clip'
    const explanation =
      typeof row.explanation === 'string' && row.explanation.trim()
        ? row.explanation.trim().slice(0, 500)
        : typeof row.reason === 'string'
          ? row.reason.slice(0, 500)
          : 'Engaging moment detected by AI'
    const scoreRaw =
      typeof row.viralityScore === 'number'
        ? row.viralityScore
        : typeof row.virality_score === 'number'
          ? row.virality_score
          : 70

    try {
      out.push(
        viralSegmentSchema.parse({
          start,
          end,
          title,
          explanation,
          viralityScore: Math.max(1, Math.min(100, scoreRaw)),
        })
      )
    } catch {
      /* skip invalid row */
    }
  }

  out.sort((a, b) => b.viralityScore - a.viralityScore)
  return out.slice(0, 7)
}

/** Coerce Gemini video JSON into safe values before Zod / after parse. */
export function preprocessGeminiVideoRaw(raw: unknown, durationSeconds: number): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const o = { ...(raw as Record<string, unknown>) }
  const duration = Math.max(1, durationSeconds)

  if (typeof o.hookTitle !== 'string' || !o.hookTitle.trim()) {
    o.hookTitle = 'Watch this'
  }
  if (typeof o.hookPlan !== 'string' || !o.hookPlan.trim()) {
    o.hookPlan = 'Strong opening moment for a vertical short'
  }

  normalizeEnumFields(o)

  const viralFromModel =
    o.viralSegments ?? o.viral_segments ?? o.clips ?? o.segments
  const viralSegments = normalizeViralSegmentsRaw(viralFromModel, duration)
  if (viralSegments.length > 0) {
    o.viralSegments = viralSegments
    const best = viralSegments[0]
    o.primaryWindow = {
      start: best.start,
      end: best.end,
      confidence: Math.min(1, best.viralityScore / 100),
      reason: best.explanation,
    }
    if (typeof o.hookTitle !== 'string' || !String(o.hookTitle).trim()) {
      o.hookTitle = best.title
    }
  }

  const pwRaw = o.primaryWindow
  if (pwRaw && typeof pwRaw === 'object') {
    const pw = { ...(pwRaw as Record<string, unknown>) }
    let start = typeof pw.start === 'number' && Number.isFinite(pw.start) ? pw.start : 0
    let end = typeof pw.end === 'number' && Number.isFinite(pw.end) ? pw.end : start + 20
    if (end <= start) end = Math.min(duration, start + 20)
    start = Math.max(0, Math.min(start, duration - 1))
    end = Math.max(start + 5, Math.min(end, duration))
    if (end - start > 45) end = start + 45
    pw.start = start
    pw.end = end
    if (typeof pw.confidence !== 'number' || !Number.isFinite(pw.confidence)) {
      pw.confidence = 0.75
    }
    if (typeof pw.reason !== 'string' || !pw.reason.trim()) {
      pw.reason = 'Best continuous excerpt for a short'
    }
    o.primaryWindow = pw
  } else {
    const end = Math.min(duration, 28)
    o.primaryWindow = {
      start: 0,
      end,
      confidence: 0.5,
      reason: 'Fallback excerpt (model omitted primaryWindow)',
    }
  }

  return o
}

export function normalizeGeminiVideoPlan(
  plan: GeminiVideoPlan,
  durationSeconds: number
): GeminiVideoPlan {
  const preprocessed = preprocessGeminiVideoRaw(plan, durationSeconds)
  return geminiVideoPlanSchema.parse(preprocessed)
}
