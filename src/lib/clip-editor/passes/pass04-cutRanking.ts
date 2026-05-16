import { cutRankingSchema } from '@/lib/clip-editor/schemas'
import type {
  CutRanking,
  HookAnalysis,
  RetentionAnalysis,
  TranscriptAnalysis,
} from '@/lib/clip-editor/types'

function segmentScore(params: {
  start: number
  end: number
  hookScore: number
  emotionalIntensity: number
  speakingSpeed: number
  surpriseFactor: number
  deadAirPenalty: number
  fillerPenalty: number
}): number {
  return (
    params.hookScore * 0.35 +
    params.emotionalIntensity * 25 +
    params.speakingSpeed * 8 +
    params.surpriseFactor * 20 -
    params.deadAirPenalty * 15 -
    params.fillerPenalty * 12
  )
}

const FILLER = new Set(['um', 'uh', 'like', 'you know', 'basically', 'literally'])

export function runCutRankingPass(
  transcript: TranscriptAnalysis,
  hooks: HookAnalysis,
  retention: RetentionAnalysis
): CutRanking {
  const duration = transcript.durationSeconds
  const candidates: CutRanking['segments'] = []

  for (const hook of hooks.hooks) {
    const start = Math.max(0, hook.start)
    const end = Math.min(duration, Math.max(hook.end, start + 2))
    const overlapDrop = retention.dropMoments.some(
      (d) => d.start < end && d.end > start && d.severity > 0.55
    )
    if (overlapDrop && hook.score < 70) continue
    const wordsInRange = transcript.words.filter((w) => w.start >= start && w.end <= end + 0.2)
    const spokenSeconds = Math.max(0.5, end - start)
    const wps = wordsInRange.length / spokenSeconds
    const fillerCount = wordsInRange.filter((w) => FILLER.has(w.word.toLowerCase())).length
    const deadAir = transcript.pauses.filter((p) => p.start >= start && p.end <= end).length
    const emotion = transcript.emotionSignals.filter((e) => e.atSeconds >= start && e.atSeconds <= end)
    const emotionalIntensity =
      emotion.length > 0 ? emotion.reduce((s, e) => s + e.intensity, 0) / emotion.length : 0.25

    const score = segmentScore({
      start,
      end,
      hookScore: hook.score,
      emotionalIntensity,
      speakingSpeed: Math.min(1.2, wps / 3.5),
      surpriseFactor: hook.category === 'surprise' ? 1 : 0.4,
      deadAirPenalty: deadAir * 0.2,
      fillerPenalty: fillerCount * 0.15,
    })

    candidates.push({
      start,
      end,
      score,
      hookScore: hook.score,
      emotionalIntensity,
      speakingSpeed: wps,
      surpriseFactor: hook.category === 'surprise' ? 1 : 0.35,
      deadAirPenalty: deadAir,
      fillerPenalty: fillerCount,
      reason: hook.reason,
    })
  }

  if (candidates.length === 0) {
    const window = Math.min(45, duration)
    candidates.push({
      start: 0,
      end: window,
      score: 55,
      reason: 'Fallback full-window segment',
    })
  }

  candidates.sort((a, b) => b.score - a.score)
  const merged = candidates.slice(0, 6)

  return cutRankingSchema.parse({ segments: merged })
}
