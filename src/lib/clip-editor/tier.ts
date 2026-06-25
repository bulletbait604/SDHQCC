/**
 * Clip Editor quality tier — set CLIP_EDITOR_QUALITY_TIER=fast|standard|max in Vercel / .env.
 * Redeploy after changing (server reads env at runtime).
 */

export type ClipEditorQualityTier = 'fast' | 'standard' | 'max'

export type ClipEditorViralityPhase = 'cut' | 'effects' | 'text'

export type ClipEditorTierConfig = {
  tier: ClipEditorQualityTier
  label: string
  description: string
  /** Rough per-clip budget hint for UI (not a hard cap). */
  targetMaxUsd: number
  useGeminiVideoAnalysis: boolean
  useGeminiHookRetentionAnalysis: boolean
  viralityReviewPhases: ClipEditorViralityPhase[]
  useGeminiPacing: boolean
  renderCutPreview: boolean
  richCaptions: boolean
  useGeminiHookOverlay: boolean
  useGeminiMetadata: boolean
  broll: {
    enabled: boolean
    maxPlacements: number
    provider: 'none' | 'fal' | 'runway'
    confidenceThreshold: number
  }
  renderResolution: '720' | '1080'
  shotstackRenderCount: number
  geminiTextPassMultiplier: number
}

const TIER_PRESETS: Record<ClipEditorQualityTier, Omit<ClipEditorTierConfig, 'tier'>> = {
  fast: {
    label: 'Fast',
    description:
      'Transcript-driven cuts, rule-based zooms, single 720p render. Skips Gemini video watch and cut preview.',
    targetMaxUsd: 0.65,
    useGeminiVideoAnalysis: false,
    useGeminiHookRetentionAnalysis: false,
    viralityReviewPhases: [],
    useGeminiPacing: false,
    renderCutPreview: false,
    richCaptions: false,
    useGeminiHookOverlay: false,
    useGeminiMetadata: false,
    broll: { enabled: false, maxPlacements: 0, provider: 'none', confidenceThreshold: 1 },
    renderResolution: '720',
    shotstackRenderCount: 1,
    geminiTextPassMultiplier: 0,
  },
  standard: {
    label: 'Standard',
    description:
      'Gemini watches the clip, plans hooks and pacing, cut preview + final 1080p with rich captions.',
    targetMaxUsd: 1.05,
    useGeminiVideoAnalysis: true,
    useGeminiHookRetentionAnalysis: true,
    viralityReviewPhases: ['cut'],
    useGeminiPacing: true,
    renderCutPreview: true,
    richCaptions: true,
    useGeminiHookOverlay: true,
    useGeminiMetadata: true,
    broll: { enabled: true, maxPlacements: 1, provider: 'none', confidenceThreshold: 0.8 },
    renderResolution: '1080',
    shotstackRenderCount: 2,
    geminiTextPassMultiplier: 1.2,
  },
  max: {
    label: 'Max',
    description:
      'Full multi-pass virality reviews, AI hook overlays, Fal b-roll inserts, dual renders at 1080p.',
    targetMaxUsd: 1.85,
    useGeminiVideoAnalysis: true,
    useGeminiHookRetentionAnalysis: true,
    viralityReviewPhases: ['cut', 'effects', 'text'],
    useGeminiPacing: true,
    renderCutPreview: true,
    richCaptions: true,
    useGeminiHookOverlay: true,
    useGeminiMetadata: true,
    broll: { enabled: true, maxPlacements: 2, provider: 'runway', confidenceThreshold: 0.65 },
    renderResolution: '1080',
    shotstackRenderCount: 2,
    geminiTextPassMultiplier: 1.8,
  },
}

export function parseClipEditorQualityTier(raw: string | undefined): ClipEditorQualityTier {
  const v = (raw || 'standard').trim().toLowerCase()
  if (v === 'fast' || v === 'standard' || v === 'max') return v
  return 'standard'
}

/** Active tier from CLIP_EDITOR_QUALITY_TIER (default: standard). */
export function clipEditorQualityTier(): ClipEditorQualityTier {
  return parseClipEditorQualityTier(process.env.CLIP_EDITOR_QUALITY_TIER)
}

export function clipEditorTierConfig(
  tier: ClipEditorQualityTier = clipEditorQualityTier()
): ClipEditorTierConfig {
  const preset = TIER_PRESETS[tier]
  return { tier, ...preset }
}

export function shouldRunViralityPhase(
  phase: ClipEditorViralityPhase,
  config: ClipEditorTierConfig = clipEditorTierConfig()
): boolean {
  return config.viralityReviewPhases.includes(phase)
}

export function clipEditorTierPublicSummary(
  config: ClipEditorTierConfig = clipEditorTierConfig()
) {
  return {
    tier: config.tier,
    label: config.label,
    description: config.description,
    targetMaxUsd: config.targetMaxUsd,
    envVar: 'CLIP_EDITOR_QUALITY_TIER',
  }
}
