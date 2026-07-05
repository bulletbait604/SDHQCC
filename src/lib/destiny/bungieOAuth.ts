/**
 * Bungie OAuth — authorization code flow (confidential client).
 */

import {
  BUNGIE_OAUTH_AUTHORIZE_URL,
  BUNGIE_OAUTH_TOKEN_URL,
  bungieOAuthClientId,
  bungieOAuthClientSecret,
  bungieOAuthRedirectUri,
  BUNGIE_API_BASE,
  destinyApiKey,
} from '@/lib/destiny/env'
import { buildBungieIconUrl } from '@/lib/destiny/manifest'
import { bungieMembershipTypeLabel } from '@/lib/destiny/bungieClient'

export interface BungieOAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresIn: number
  refreshExpiresIn?: number
  membershipId: string
  obtainedAt: string
}

export interface BungieDestinyMembership {
  membershipId: string
  membershipType: number
  displayName: string
  bungieGlobalDisplayName?: string
  bungieGlobalDisplayNameCode?: number
  crossSaveOverride?: number
  isPublic?: boolean
}

interface BungieEnvelope<T> {
  ErrorCode: number
  Message: string
  Response: T
}

async function bungieOAuthFetch<T>(url: string, init: RequestInit): Promise<T> {
  const apiKey = destinyApiKey()
  if (!apiKey) throw new Error('DESTINY_API is not configured')

  const res = await fetch(url, {
    ...init,
    headers: {
      'X-API-Key': apiKey,
      ...(init.headers as Record<string, string>),
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Bungie OAuth HTTP ${res.status}: ${text}`)
  }

  const body = (await res.json()) as BungieEnvelope<T>
  if (body.ErrorCode !== 1) {
    throw new Error(body.Message || `Bungie error ${body.ErrorCode}`)
  }

  return body.Response
}

export function buildBungieAuthorizeUrl(state: string): string {
  const clientId = bungieOAuthClientId()
  const redirectUri = bungieOAuthRedirectUri()
  if (!clientId) throw new Error('BUNGIE_OAUTH_CLIENT_ID is not configured')

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  })

  return `${BUNGIE_OAUTH_AUTHORIZE_URL}?${params.toString()}`
}

export async function exchangeBungieAuthorizationCode(code: string): Promise<BungieOAuthTokens> {
  const clientId = bungieOAuthClientId()
  const clientSecret = bungieOAuthClientSecret()
  const apiKey = destinyApiKey()
  if (!clientId || !clientSecret || !apiKey) {
    throw new Error('Bungie OAuth client credentials are not configured')
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(BUNGIE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-API-Key': apiKey,
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
    }).toString(),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Bungie token exchange failed: ${res.status} ${await res.text()}`)
  }

  const response = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    refresh_expires_in?: number
    membership_id: string
  }

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresIn: response.expires_in,
    refreshExpiresIn: response.refresh_expires_in,
    membershipId: String(response.membership_id),
    obtainedAt: new Date().toISOString(),
  }
}

export async function refreshBungieAccessToken(refreshToken: string): Promise<BungieOAuthTokens> {
  const clientId = bungieOAuthClientId()
  const clientSecret = bungieOAuthClientSecret()
  const apiKey = destinyApiKey()
  if (!clientId || !clientSecret || !apiKey) {
    throw new Error('Bungie OAuth client credentials are not configured')
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(BUNGIE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-API-Key': apiKey,
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }).toString(),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Bungie token refresh failed: ${res.status} ${await res.text()}`)
  }

  const response = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    refresh_expires_in?: number
    membership_id: string
  }

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? refreshToken,
    expiresIn: response.expires_in,
    refreshExpiresIn: response.refresh_expires_in,
    membershipId: String(response.membership_id),
    obtainedAt: new Date().toISOString(),
  }
}

export async function getDestinyMembershipsForCurrentUser(
  accessToken: string
): Promise<{
  bungieNetUser?: { membershipId: string; displayName?: string }
  destinyMemberships: BungieDestinyMembership[]
  primaryMembershipId?: string
}> {
  return bungieOAuthFetch(`${BUNGIE_API_BASE}/User/GetMembershipsForCurrentUser/`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

/** Pick primary Destiny membership (cross-save primary when present). */
export function pickPrimaryDestinyMembership(
  memberships: BungieDestinyMembership[],
  crossSaveOverride?: number
): BungieDestinyMembership | undefined {
  if (!memberships.length) return undefined
  if (crossSaveOverride) {
    const primary = memberships.find((m) => m.membershipId === String(crossSaveOverride))
    if (primary) return primary
  }
  return memberships[0]
}

export async function fetchLinkedGuardianSummary(
  membershipType: number,
  membershipId: string,
  accessToken: string
): Promise<{
  displayName: string
  emblemUrl?: string
  powerLevel?: number
  characterClass?: 'titan' | 'hunter' | 'warlock'
}> {
  const profile = await bungieOAuthFetch<{
    profiles?: {
      data?: {
        displayName?: string
        currentGuardianRank?: number
      }
    }
    characters?: {
      data?: Record<
        string,
        {
          classType?: number
          light?: number
          emblemPath?: string
        }
      >
    }
  }>(`${BUNGIE_API_BASE}/Destiny2/${membershipType}/Profile/${membershipId}/?components=100,200`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const characters = profile.characters?.data ?? {}
  const characterEntries = Object.values(characters)
  const best = characterEntries.sort((a, b) => (b.light ?? 0) - (a.light ?? 0))[0]
  const classMap: Record<number, 'titan' | 'hunter' | 'warlock'> = {
    0: 'titan',
    1: 'hunter',
    2: 'warlock',
  }

  const profileData = profile.profiles?.data

  return {
    displayName: profileData?.displayName ?? 'Guardian',
    emblemUrl: best?.emblemPath ? buildBungieIconUrl(best.emblemPath) : undefined,
    powerLevel: best?.light,
    characterClass: best?.classType != null ? classMap[best.classType] : undefined,
  }
}

export function platformFromMembershipType(type: number): string {
  const label = bungieMembershipTypeLabel(type)
  if (label === 'xbox' || label === 'playstation' || label === 'steam' || label === 'epic') {
    return label
  }
  return 'steam'
}

export function formatBungieDisplayName(m: BungieDestinyMembership): string {
  if (m.bungieGlobalDisplayName && m.bungieGlobalDisplayNameCode != null) {
    return `${m.bungieGlobalDisplayName}#${String(m.bungieGlobalDisplayNameCode).padStart(4, '0')}`
  }
  return m.displayName
}
