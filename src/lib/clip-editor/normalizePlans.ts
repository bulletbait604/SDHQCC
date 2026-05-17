import type { GeminiVideoPlan } from '@/lib/clip-editor/types'

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
  const preprocessed = preprocessGeminiVideoRaw(plan, durationSeconds) as GeminiVideoPlan
  return preprocessed
}
