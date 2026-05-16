/**
 * Rough per-clip API cost estimate (not invoicing-grade). Override via env:
 * ESTIMATE_CLIP_EDITOR_DEEPGRAM_PER_MIN, ESTIMATE_CLIP_EDITOR_GEMINI_VIDEO_USD,
 * ESTIMATE_CLIP_EDITOR_GEMINI_TEXT_USD, ESTIMATE_CLIP_EDITOR_SHOTSTACK_RENDER_USD,
 * ESTIMATE_CLIP_EDITOR_QSTASH_USD
 */

export type ClipEditorCostLine = {
  provider: string
  label: string
  estimatedUsd: number
  note: string
}

export type ClipEditorCostEstimate = {
  sourceDurationSeconds: number
  outputDurationSecondsAssumed: number
  totalEstimatedUsd: number
  lines: ClipEditorCostLine[]
  disclaimer: string
}

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export function estimateClipEditorCost(sourceDurationSeconds: number): ClipEditorCostEstimate {
  const duration = Math.min(120, Math.max(1, sourceDurationSeconds))
  const outputSeconds = Math.min(38, Math.max(14, duration * 0.4))

  const deepgramPerMin = numEnv('ESTIMATE_CLIP_EDITOR_DEEPGRAM_PER_MIN', 0.0048)
  const geminiVideoFlat = numEnv('ESTIMATE_CLIP_EDITOR_GEMINI_VIDEO_USD', 0.18)
  const geminiVideoPerMin = numEnv('ESTIMATE_CLIP_EDITOR_GEMINI_VIDEO_PER_MIN', 0.012)
  const geminiText = numEnv('ESTIMATE_CLIP_EDITOR_GEMINI_TEXT_USD', 0.025)
  const shotstackRender = numEnv('ESTIMATE_CLIP_EDITOR_SHOTSTACK_RENDER_USD', 0.35)
  const qstash = numEnv('ESTIMATE_CLIP_EDITOR_QSTASH_USD', 0.002)

  const deepgramUsd = (duration / 60) * deepgramPerMin
  const geminiVideoUsd = geminiVideoFlat + (duration / 60) * geminiVideoPerMin
  const lines: ClipEditorCostLine[] = [
    {
      provider: 'deepgram',
      label: 'Transcription (nova-3)',
      estimatedUsd: deepgramUsd,
      note: `~${duration.toFixed(0)}s source audio`,
    },
    {
      provider: 'gemini',
      label: 'Video analysis (watches full clip)',
      estimatedUsd: geminiVideoUsd,
      note: '1× Gemini call with video input',
    },
    {
      provider: 'gemini',
      label: 'Text passes (hooks, retention, pacing, metadata)',
      estimatedUsd: geminiText,
      note: '4× transcript-only JSON calls',
    },
    {
      provider: 'shotstack',
      label: 'Final render (1080×1920)',
      estimatedUsd: shotstackRender,
      note: `Assumes ~${outputSeconds.toFixed(0)}s output; plan-dependent`,
    },
    {
      provider: 'upstash',
      label: 'QStash orchestration',
      estimatedUsd: qstash,
      note: '~12–15 step invocations',
    },
  ]

  const totalEstimatedUsd = lines.reduce((sum, line) => sum + line.estimatedUsd, 0)

  return {
    sourceDurationSeconds: duration,
    outputDurationSecondsAssumed: outputSeconds,
    totalEstimatedUsd: Number(totalEstimatedUsd.toFixed(3)),
    lines: lines.map((line) => ({
      ...line,
      estimatedUsd: Number(line.estimatedUsd.toFixed(3)),
    })),
    disclaimer:
      'Estimates only. Actual Gemini video cost scales with resolution, FPS sampling, and token usage. Shotstack billing depends on sandbox vs production plan.',
  }
}
