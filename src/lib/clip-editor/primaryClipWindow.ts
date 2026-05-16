import type { CutRanking } from '@/lib/clip-editor/types'

/** One continuous excerpt around the top-ranked hook (avoids chaotic multi-segment montages). */
export function buildPrimaryClipWindow(
  ranking: CutRanking,
  durationSeconds: number
): { start: number; end: number } {
  const duration = Math.max(1, durationSeconds)
  const best = ranking.segments[0]
  if (!best) {
    return { start: 0, end: Math.min(28, duration) }
  }

  const targetLen = Math.min(38, Math.max(14, duration * 0.75))
  let start = Math.max(0, best.start - 0.8)
  let end = Math.min(duration, best.end + 0.8)

  if (end - start < targetLen) {
    const pad = (targetLen - (end - start)) / 2
    start = Math.max(0, start - pad)
    end = Math.min(duration, end + pad)
  }

  if (end - start > 45) {
    const center = (best.start + best.end) / 2
    start = Math.max(0, center - 22)
    end = Math.min(duration, start + 45)
  }

  if (end - start < 10) {
    end = Math.min(duration, start + 12)
  }

  return {
    start: Number(start.toFixed(2)),
    end: Number(end.toFixed(2)),
  }
}
