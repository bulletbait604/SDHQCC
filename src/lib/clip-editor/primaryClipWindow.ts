import type { ClipEditorPlatform, CutRanking, GeminiVideoPlan } from '@/lib/clip-editor/types'
import { expandExcerptWindow } from '@/lib/clip-editor/excerptBounds'

/** One continuous excerpt around the top-ranked hook (avoids chaotic multi-segment montages). */
export function buildPrimaryClipWindow(
  ranking: CutRanking,
  durationSeconds: number,
  geminiVideo?: GeminiVideoPlan,
  platform: ClipEditorPlatform = 'tiktok'
): { start: number; end: number } {
  const duration = Math.max(1, durationSeconds)

  if (geminiVideo?.viralSegments?.length) {
    const best = geminiVideo.viralSegments[0]
    return expandExcerptWindow({
      start: best.start,
      end: best.end,
      duration,
      platform,
      hookFocusAt: best.start,
    })
  }

  if (geminiVideo?.primaryWindow && geminiVideo.primaryWindow.confidence >= 0.55) {
    const g = geminiVideo.primaryWindow
    return expandExcerptWindow({
      start: g.start,
      end: g.end,
      duration,
      platform,
      hookFocusAt: g.start,
    })
  }

  const best = ranking.segments[0]
  if (!best) {
    return expandExcerptWindow({
      start: 0,
      end: Math.min(28, duration),
      duration,
      platform,
      hookFocusAt: 0,
    })
  }

  return expandExcerptWindow({
    start: Math.max(0, best.start - 0.8),
    end: Math.min(duration, best.end + 0.8),
    duration,
    platform,
    hookFocusAt: best.start,
  })
}
