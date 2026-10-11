import { FREE_DAILY_ANALYSIS_QUOTA, FREE_DAILY_TAG_QUOTA } from '@/lib/billing/plans'

export type QuotaBucket = 'analysis' | 'tags'

const QUOTA_LIMITS: Record<QuotaBucket, number> = {
  analysis: FREE_DAILY_ANALYSIS_QUOTA,
  tags: FREE_DAILY_TAG_QUOTA,
}

/** Tools with a daily free allowance. Thumbnails and Post4Me are intentionally absent. */
export function quotaBucketForTool(tool: string): QuotaBucket | null {
  if (tool === 'clip-analyzer' || tool === 'home-clip-analyze' || tool === 'content-analyzer') {
    return 'analysis'
  }
  if (tool === 'tag-generator') return 'tags'
  return null
}

export function quotaLimitForBucket(bucket: QuotaBucket | null): number | null {
  if (!bucket) return null
  return QUOTA_LIMITS[bucket]
}

export function utcQuotaDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export type AccessDecision =
  | { via: 'pro' }
  | { via: 'quota' }
  | { via: 'coins' }
  | { via: 'denied'; required: number; available: number }

/** Pure gate used by tests and by the Mongo-backed helpers. */
export function decideToolAccess(input: {
  pro: boolean
  quotaLimit: number | null
  quotaUsed: number
  coinBalance: number
  coinCost: number
}): AccessDecision {
  if (input.pro) return { via: 'pro' }
  if (input.quotaLimit !== null && input.quotaLimit - input.quotaUsed > 0) {
    return { via: 'quota' }
  }
  if (input.coinBalance >= input.coinCost) return { via: 'coins' }
  return {
    via: 'denied',
    required: input.coinCost,
    available: input.coinBalance,
  }
}
