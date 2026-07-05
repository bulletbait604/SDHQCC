/** Destiny / Bungie API environment helpers. */

export function destinyApiKey(): string | undefined {
  const key = process.env.DESTINY_API || process.env.BUNGIE_API_KEY || ''
  return key.trim() || undefined
}

export function destinyApiConfigured(): boolean {
  return Boolean(destinyApiKey())
}

export function bungieOAuthClientId(): string | undefined {
  const id =
    process.env.BUNGIE_OAUTH_CLIENT_ID ||
    process.env.BUNGIE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_BUNGIE_OAUTH_CLIENT_ID ||
    ''
  return id.trim() || undefined
}

export function bungieOAuthClientSecret(): string | undefined {
  const secret =
    process.env.BUNGIE_OAUTH_CLIENT_SECRET ||
    process.env.BUNGIE_CLIENT_SECRET ||
    process.env.BUNGIE_SECRET ||
    ''
  return secret.trim() || undefined
}

export function bungieOAuthConfigured(): boolean {
  return Boolean(bungieOAuthClientId() && bungieOAuthClientSecret() && destinyApiKey())
}

export function bungieOAuthRedirectUri(): string {
  const explicit =
    process.env.BUNGIE_OAUTH_REDIRECT_URI || process.env.NEXT_PUBLIC_BUNGIE_REDIRECT_URI
  if (explicit?.trim()) return explicit.trim()

  const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim()
  if (base) return `${base.replace(/\/$/, '')}/api/destiny/auth/bungie/callback`

  const vercel = (process.env.VERCEL_URL || '').trim()
  if (vercel) return `https://${vercel}/api/destiny/auth/bungie/callback`

  return 'http://localhost:3000/api/destiny/auth/bungie/callback'
}

export const BUNGIE_API_BASE = 'https://www.bungie.net/Platform'
export const BUNGIE_OAUTH_AUTHORIZE_URL = 'https://www.bungie.net/en/OAuth/Authorize'
export const BUNGIE_OAUTH_TOKEN_URL = 'https://www.bungie.net/Platform/App/OAuth/token/'

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
