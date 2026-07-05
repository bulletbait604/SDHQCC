import type { NextRequest } from 'next/server'

export const BUNGIE_OAUTH_CALLBACK_PATH = '/api/destiny/auth/bungie/callback'

/** Normalize to the exact callback URL Bungie expects (no trailing slash, fixed path). */
export function normalizeBungieRedirectUri(uri: string): string {
  const trimmed = uri.trim()
  if (!trimmed) return trimmed

  try {
    const url = new URL(trimmed)
    url.pathname = BUNGIE_OAUTH_CALLBACK_PATH
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    const base = trimmed.replace(/\/+$/, '')
    if (base.endsWith(BUNGIE_OAUTH_CALLBACK_PATH)) return base
    return `${base}${BUNGIE_OAUTH_CALLBACK_PATH}`
  }
}

function originFromBaseUrl(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  try {
    const withProto = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    return new URL(withProto).origin
  } catch {
    return undefined
  }
}

function canonicalOriginFromEnv(): string | undefined {
  const explicit = process.env.BUNGIE_OAUTH_REDIRECT_URI || process.env.NEXT_PUBLIC_BUNGIE_REDIRECT_URI
  if (explicit?.trim()) {
    try {
      return new URL(normalizeBungieRedirectUri(explicit)).origin
    } catch {
      /* fall through */
    }
  }

  for (const key of [
    'NEXT_PUBLIC_BASE_URL',
    'NEXT_PUBLIC_APP_URL',
    'VERCEL_PROJECT_PRODUCTION_URL',
  ] as const) {
    const origin = originFromBaseUrl(process.env[key] || '')
    if (origin) return origin
  }

  if (process.env.VERCEL_ENV === 'production') {
    const vercel = (process.env.VERCEL_URL || '').trim()
    if (vercel) return `https://${vercel.replace(/\/$/, '')}`
  }

  return undefined
}

export function requestPublicOrigin(req?: NextRequest | { url: string; headers?: Headers }): string | undefined {
  if (!req) return undefined

  const headers = 'headers' in req ? req.headers : undefined
  if (headers) {
    const forwardedHost = headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    const host = forwardedHost || headers.get('host')?.trim()
    if (host) {
      const proto = headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
      return `${proto}://${host}`
    }
  }

  try {
    return new URL(req.url).origin
  } catch {
    return undefined
  }
}

export function bungieOAuthRedirectUri(): string {
  const explicit =
    process.env.BUNGIE_OAUTH_REDIRECT_URI || process.env.NEXT_PUBLIC_BUNGIE_REDIRECT_URI
  if (explicit?.trim()) return normalizeBungieRedirectUri(explicit)

  const origin = canonicalOriginFromEnv()
  if (origin) return normalizeBungieRedirectUri(`${origin}${BUNGIE_OAUTH_CALLBACK_PATH}`)

  return normalizeBungieRedirectUri('http://localhost:3000/api/destiny/auth/bungie/callback')
}

/**
 * Redirect URI sent to Bungie on authorize + token exchange.
 * Prefer explicit env/canonical production URL so it always matches the Bungie portal.
 */
export function bungieOAuthRedirectUriFromRequest(req?: NextRequest): string {
  const explicit =
    process.env.BUNGIE_OAUTH_REDIRECT_URI || process.env.NEXT_PUBLIC_BUNGIE_REDIRECT_URI
  if (explicit?.trim()) return normalizeBungieRedirectUri(explicit)

  const canonicalOrigin = canonicalOriginFromEnv()
  if (canonicalOrigin) {
    return normalizeBungieRedirectUri(`${canonicalOrigin}${BUNGIE_OAUTH_CALLBACK_PATH}`)
  }

  const requestOrigin = requestPublicOrigin(req)
  if (requestOrigin) {
    return normalizeBungieRedirectUri(`${requestOrigin}${BUNGIE_OAUTH_CALLBACK_PATH}`)
  }

  return bungieOAuthRedirectUri()
}

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

export const BUNGIE_API_BASE = 'https://www.bungie.net/Platform' // https://bungie-net.github.io/
export const BUNGIE_OAUTH_AUTHORIZE_URL = 'https://www.bungie.net/en/oauth/authorize'
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
