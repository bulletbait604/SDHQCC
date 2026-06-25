/**
 * Rough per-clip API cost estimate (not invoicing-grade). Override via env:
 * ESTIMATE_CLIP_EDITOR_DEEPGRAM_PER_MIN, ESTIMATE_CLIP_EDITOR_GEMINI_VIDEO_USD,
 * ESTIMATE_CLIP_EDITOR_GEMINI_TEXT_USD, ESTIMATE_CLIP_EDITOR_SHOTSTACK_RENDER_USD,
 * ESTIMATE_CLIP_EDITOR_QSTASH_USD
 */

import {
  clipEditorQualityTier,
  clipEditorTierConfig,
  clipEditorTierPublicSummary,
  type ClipEditorQualityTier,
} from '@/lib/clip-editor/tier'

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
  tier: ReturnType<typeof clipEditorTierPublicSummary>
}

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export function estimateClipEditorCost(
  sourceDurationSeconds: number,
  tierName: ClipEditorQualityTier = clipEditorQualityTier()
): ClipEditorCostEstimate {
  const tier = clipEditorTierConfig(tierName)
  const duration = Math.min(120, Math.max(1, sourceDurationSeconds))
  const outputSeconds = Math.min(38, Math.max(14, duration * 0.4))

  const deepgramPerMin = numEnv('ESTIMATE_CLIP_EDITOR_DEEPGRAM_PER_MIN', 0.0048)
  const geminiVideoFlat = numEnv('ESTIMATE_CLIP_EDITOR_GEMINI_VIDEO_USD', 0.18)
  const geminiVideoPerMin = numEnv('ESTIMATE_CLIP_EDITOR_GEMINI_VIDEO_PER_MIN', 0.012)
  const geminiText = numEnv('ESTIMATE_CLIP_EDITOR_GEMINI_TEXT_USD', 0.025)
  const shotstackRenderEach = numEnv('ESTIMATE_CLIP_EDITOR_SHOTSTACK_RENDER_USD', 0.35)
  const qstash = numEnv('ESTIMATE_CLIP_EDITOR_QSTASH_USD', 0.002)

  const deepgramUsd = (duration / 60) * deepgramPerMin
  const geminiVideoUsd = tier.useGeminiVideoAnalysis
    ? geminiVideoFlat + (duration / 60) * geminiVideoPerMin
    : 0
  const geminiTextUsd = geminiText * tier.geminiTextPassMultiplier
  const shotstackUsd = shotstackRenderEach * tier.shotstackRenderCount
  const falBrollUsd =
    tier.broll.enabled && tier.broll.provider === 'fal'
      ? numEnv('ESTIMATE_CLIP_EDITOR_FAL_BROLL_USD', 0.08) * tier.broll.maxPlacements
      : 0

  const lines: ClipEditorCostLine[] = [
    {
      provider: 'deepgram',
      label: 'Transcription (nova-3)',
      estimatedUsd: deepgramUsd,
      note: `~${duration.toFixed(0)}s source audio`,
    },
  ]

  if (tier.useGeminiVideoAnalysis) {
    lines.push({
      provider: 'gemini',
      label: 'Video analysis (watches full clip)',
      estimatedUsd: geminiVideoUsd,
      note: '1× Gemini call with video input',
    })
  } else {
    lines.push({
      provider: 'local',
      label: 'Transcript heuristics (fast tier)',
      estimatedUsd: 0,
      note: 'No Gemini video pass',
    })
  }

  if (geminiTextUsd > 0) {
    lines.push({
      provider: 'gemini',
      label: 'Text passes (hooks, virality, pacing, captions, metadata)',
      estimatedUsd: geminiTextUsd,
      note: `${tier.geminiTextPassMultiplier.toFixed(1)}× text pass bundle (${tier.label})`,
    })
  }

  lines.push({
    provider: 'shotstack',
    label: 'Renders',
    estimatedUsd: shotstackUsd,
    note: `${tier.shotstackRenderCount}× @ ${tier.renderResolution}p · ~${outputSeconds.toFixed(0)}s output`,
  })

  if (falBrollUsd > 0) {
    lines.push({
      provider: 'fal',
      label: 'B-roll inserts',
      estimatedUsd: falBrollUsd,
      note: `Up to ${tier.broll.maxPlacements} Fal asset(s)`,
    })
  }

  lines.push({
    provider: 'upstash',
    label: 'QStash orchestration',
    estimatedUsd: qstash,
    note: 'Step invocations (varies by tier)',
  })

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
      'Estimates only. Set CLIP_EDITOR_QUALITY_TIER=fast|standard|max. Actual costs vary by provider plan.',
    tier: clipEditorTierPublicSummary(tier),
  }
}
