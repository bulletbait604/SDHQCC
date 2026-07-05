/**
 * Bungie OAuth — authorization code flow (confidential client).
 */

import JSONbig from 'json-bigint'
import {
  BUNGIE_OAUTH_AUTHORIZE_URL,
  BUNGIE_OAUTH_TOKEN_URL,
  bungieOAuthClientId,
  bungieOAuthClientSecret,
  bungieOAuthRedirectUri,
  BUNGIE_API_BASE,
  destinyApiKey,
} from '@/lib/destiny/env'
import { buildBungieIconUrl } from '@/lib/destiny/bungieUrls'
import { bungieMembershipTypeLabel } from '@/lib/destiny/bungieClient'

const parseBungieJson = JSONbig({ storeAsString: true })

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

export function normalizeBungieMembershipId(value: unknown): string {
  if (value == null || value === '') return ''
  return String(value)
}

async function readBungieJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text.trim()) {
    throw new Error('Empty response from Bungie')
  }
  return parseBungieJson.parse(text) as T
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

  const body = await readBungieJson<BungieEnvelope<T>>(res)
  if (body.ErrorCode !== 1) {
    throw new Error(body.Message || `Bungie error ${body.ErrorCode}`)
  }

  return body.Response
}

export function buildBungieAuthorizeUrl(state: string, redirectUri?: string): string {
  const clientId = bungieOAuthClientId()
  const resolvedRedirect = redirectUri || bungieOAuthRedirectUri()
  if (!clientId) throw new Error('BUNGIE_OAUTH_CLIENT_ID is not configured')

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: resolvedRedirect,
    state,
  })

  return `${BUNGIE_OAUTH_AUTHORIZE_URL}?${params.toString()}`
}

interface BungieTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  refresh_expires_in?: number
  membership_id: string | number
  error?: string
  error_description?: string
}

export async function exchangeBungieAuthorizationCode(
  code: string,
  redirectUri?: string
): Promise<BungieOAuthTokens> {
  const clientId = bungieOAuthClientId()
  const clientSecret = bungieOAuthClientSecret()
  const apiKey = destinyApiKey()
  const resolvedRedirect = redirectUri || bungieOAuthRedirectUri()
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
      redirect_uri: resolvedRedirect,
    }).toString(),
    cache: 'no-store',
  })

  const response = await readBungieJson<BungieTokenResponse>(res)

  if (!res.ok || response.error) {
    throw new Error(
      response.error_description || response.error || `Bungie token exchange failed: ${res.status}`
    )
  }

  if (!response.access_token) {
    throw new Error('Bungie token exchange returned no access token')
  }

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresIn: response.expires_in,
    refreshExpiresIn: response.refresh_expires_in,
    membershipId: normalizeBungieMembershipId(response.membership_id),
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

  const response = await readBungieJson<BungieTokenResponse>(res)

  if (!res.ok || response.error) {
    throw new Error(
      response.error_description || response.error || `Bungie token refresh failed: ${res.status}`
    )
  }

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? refreshToken,
    expiresIn: response.expires_in,
    refreshExpiresIn: response.refresh_expires_in,
    membershipId: normalizeBungieMembershipId(response.membership_id),
    obtainedAt: new Date().toISOString(),
  }
}

function normalizeMemberships(
  memberships: Array<Record<string, unknown>>
): BungieDestinyMembership[] {
  return memberships.map((row) => ({
    membershipId: normalizeBungieMembershipId(row.membershipId),
    membershipType: Number(row.membershipType ?? 0),
    displayName: String(row.displayName ?? ''),
    bungieGlobalDisplayName:
      typeof row.bungieGlobalDisplayName === 'string' ? row.bungieGlobalDisplayName : undefined,
    bungieGlobalDisplayNameCode:
      row.bungieGlobalDisplayNameCode != null ? Number(row.bungieGlobalDisplayNameCode) : undefined,
    crossSaveOverride:
      row.crossSaveOverride != null ? Number(row.crossSaveOverride) : undefined,
    isPublic: row.isPublic === true,
  }))
}

export async function getDestinyMembershipsForCurrentUser(
  accessToken: string
): Promise<{
  bungieNetUser?: { membershipId: string; displayName?: string }
  destinyMemberships: BungieDestinyMembership[]
  primaryMembershipId?: string
}> {
  const response = await bungieOAuthFetch<{
    destinyMemberships?: Array<Record<string, unknown>>
    primaryMembershipId?: string | number
    bungieNetUser?: { membershipId?: string | number; displayName?: string }
  }>(`${BUNGIE_API_BASE}/User/GetMembershipsForCurrentUser/`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return {
    bungieNetUser: response.bungieNetUser
      ? {
          membershipId: normalizeBungieMembershipId(response.bungieNetUser.membershipId),
          displayName: response.bungieNetUser.displayName,
        }
      : undefined,
    destinyMemberships: normalizeMemberships(response.destinyMemberships ?? []),
    primaryMembershipId: response.primaryMembershipId
      ? normalizeBungieMembershipId(response.primaryMembershipId)
      : undefined,
  }
}

/** Pick primary Destiny membership (cross-save primary when present). */
export function pickPrimaryDestinyMembership(
  memberships: BungieDestinyMembership[],
  primaryMembershipId?: string
): BungieDestinyMembership | undefined {
  if (!memberships.length) return undefined

  if (primaryMembershipId) {
    const primary = memberships.find((m) => m.membershipId === primaryMembershipId)
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
    profile?: {
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
  }>(
    `${BUNGIE_API_BASE}/Destiny2/${membershipType}/Profile/${membershipId}/?components=100,200`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  const characters = profile.characters?.data ?? {}
  const characterEntries = Object.values(characters)
  const best = characterEntries.sort((a, b) => (b.light ?? 0) - (a.light ?? 0))[0]
  const classMap: Record<number, 'titan' | 'hunter' | 'warlock'> = {
    0: 'titan',
    1: 'hunter',
    2: 'warlock',
  }

  const profileData = profile.profile?.data

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
