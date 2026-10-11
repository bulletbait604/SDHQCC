import { PRO_TRIAL_DAYS } from '@/lib/billing/plans'

export function trialEndsAtFrom(startedAt: Date, days = PRO_TRIAL_DAYS): Date {
  const ends = new Date(startedAt.getTime())
  ends.setUTCDate(ends.getUTCDate() + days)
  return ends
}

export function readTrialEnd(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  return null
}

export function isProTrialActive(
  endsAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!endsAt) return false
  const ends = Date.parse(endsAt)
  return Number.isFinite(ends) && ends > now.getTime()
}
