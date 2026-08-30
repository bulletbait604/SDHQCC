import {
  isViralClipDuration,
  type ViralClipDuration,
} from '@/lib/viralClipGen/config'

/**
 * Coin cost by requested clip length. Change here — do not hard-code in the UI.
 * Owner/subscriber unlimited roles still skip deduction.
 */
export const VIDEO_GENERATION_COSTS: Record<ViralClipDuration, number> = {
  5: 4,
  10: 6,
  15: 10,
  20: 12,
  30: 16,
}

export const VIRAL_CLIP_GEN_TOOL = 'viral-clip-gen' as const

export function viralClipGenCoinCost(duration: ViralClipDuration): number {
  return VIDEO_GENERATION_COSTS[duration]
}

export function viralClipGenCoinCostFromUnknown(duration: unknown): number | null {
  if (!isViralClipDuration(duration)) return null
  return VIDEO_GENERATION_COSTS[duration]
}
