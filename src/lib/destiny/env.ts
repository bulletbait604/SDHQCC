/** Destiny / Bungie API environment helpers. */

export function destinyApiKey(): string | undefined {
  const key = process.env.DESTINY_API || process.env.BUNGIE_API_KEY || ''
  return key.trim() || undefined
}

export function destinyApiConfigured(): boolean {
  return Boolean(destinyApiKey())
}

/** Bungie application OAuth — optional for Phase 2+. */
export function bungieOAuthClientId(): string | undefined {
  return (process.env.BUNGIE_OAUTH_CLIENT_ID || '').trim() || undefined
}

export function bungieOAuthClientSecret(): string | undefined {
  return (process.env.BUNGIE_OAUTH_CLIENT_SECRET || '').trim() || undefined
}

export const BUNGIE_API_BASE = 'https://www.bungie.net/Platform'

/** Scoring rules (verified full completions only). */
export const SCORING = {
  pointsPerClanMember: 2,
  pointsPerRando: 5,
  maxRandosRaid: 2,
  maxRandosDungeon: 1,
} as const

/** AI legitimacy thresholds. */
export const LEGITIMACY_THRESHOLDS = {
  autoVerifyMax: 20,
  warningMax: 39,
  manualReviewMax: 69,
} as const
