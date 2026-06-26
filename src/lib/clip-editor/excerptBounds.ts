import type { ClipEditorPlatform } from '@/lib/clip-editor/types'

export function excerptMinMaxSeconds(
  platform: ClipEditorPlatform,
  sourceDuration: number
): { min: number; max: number; ideal: number } {
  const duration = Math.max(1, sourceDuration)
  let min = 12
  let ideal = 15
  let max = 38

  switch (platform) {
    case 'tiktok':
      min = 7
      ideal = 14
      max = 38
      break
    case 'youtube':
      min = 12
      ideal = 28
      max = 45
      break
    case 'reels':
      min = 10
      ideal = 22
      max = 38
      break
  }

  if (duration <= min) {
    return { min: duration, max: duration, ideal: duration }
  }

  return {
    min,
    max: Math.min(max, duration),
    ideal: Math.min(ideal, duration),
  }
}

/** Expand a hook moment into a platform-valid continuous excerpt (not a 1–2s spike). */
export function expandExcerptWindow(params: {
  start: number
  end: number
  duration: number
  platform?: ClipEditorPlatform
  /** Peak hook timestamp — excerpt should include this second. */
  hookFocusAt?: number
}): { start: number; end: number } {
  const platform = params.platform ?? 'tiktok'
  const duration = Math.max(1, params.duration)
  const { min, max, ideal } = excerptMinMaxSeconds(platform, duration)

  let start = Math.max(0, params.start)
  let end = Math.min(duration, Math.max(params.end, start + 0.5))
  const hookAt =
    typeof params.hookFocusAt === 'number' && Number.isFinite(params.hookFocusAt)
      ? Math.max(0, Math.min(params.hookFocusAt, duration))
      : start

  let len = end - start

  if (len < min) {
    const need = min - len
    const beforeRoom = start
    const afterRoom = duration - end
    let padBefore = Math.min(beforeRoom, need * 0.4)
    let padAfter = need - padBefore
    if (padAfter > afterRoom) {
      padAfter = afterRoom
      padBefore = Math.min(beforeRoom, need - padAfter)
    }
    start = Math.max(0, start - padBefore)
    end = Math.min(duration, end + padAfter)
    if (end - start < min) {
      start = Math.max(0, Math.min(hookAt - 1, duration - min))
      end = Math.min(duration, start + min)
    }
    len = end - start
  }

  if (len > max) {
    start = Math.max(0, Math.min(hookAt - 1, duration - ideal))
    end = Math.min(duration, start + ideal)
    if (end - start > max) {
      end = start + max
    }
  }

  return {
    start: Number(start.toFixed(2)),
    end: Number(end.toFixed(2)),
  }
}

export function clampRenderSeconds(
  value: number | undefined,
  platform: ClipEditorPlatform,
  sourceDuration: number
): number {
  const { min, max, ideal } = excerptMinMaxSeconds(platform, sourceDuration)
  const fallback = ideal
  const raw = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Number(Math.min(max, Math.max(min, raw)).toFixed(2))
}
