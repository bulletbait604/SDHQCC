/**
 * Server-side Bungie / Destiny 2 API client.
 * All requests use DESTINY_API (X-API-Key). Never expose the key to the browser.
 */

import { BUNGIE_API_BASE, destinyApiKey } from '@/lib/destiny/env'

export class BungieApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public bungieErrorCode?: number
  ) {
    super(message)
    this.name = 'BungieApiError'
  }
}

interface BungieEnvelope<T> {
  ErrorCode: number
  ErrorStatus: string
  Message: string
  MessageData: Record<string, string>
  Response: T
}

async function bungieFetch<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {}
): Promise<T> {
  const apiKey = destinyApiKey()
  if (!apiKey) {
    throw new BungieApiError('DESTINY_API is not configured', 503)
  }

  const { accessToken, ...fetchOptions } = options
  const headers: Record<string, string> = {
    'X-API-Key': apiKey,
    ...(fetchOptions.headers as Record<string, string>),
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const res = await fetch(`${BUNGIE_API_BASE}${path}`, {
    ...fetchOptions,
    headers,
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new BungieApiError(`Bungie HTTP ${res.status}`, res.status)
  }

  const body = (await res.json()) as BungieEnvelope<T>
  if (body.ErrorCode !== 1) {
    throw new BungieApiError(body.Message || body.ErrorStatus, 502, body.ErrorCode)
  }

  return body.Response
}

export interface ManifestDisplayProperties {
  name?: string
  icon?: string
  description?: string
  hasIcon?: boolean
}

/** Single entity definition from live manifest. */
export async function getDestinyEntityDefinition(entityType: string, hash: number) {
  return bungieFetch<unknown>(`/Destiny2/Manifest/${entityType}/${hash}/`)
}

export interface ArmorySearchResult {
  hash: number
  name: string
  icon?: string
}

/** Search Bungie armory for manifest entities by name. */
export async function searchDestinyEntities(
  entityType: string,
  searchTerm: string,
  page = 0
): Promise<ArmorySearchResult[]> {
  const encoded = encodeURIComponent(searchTerm)
  const response = await bungieFetch<{
    searchResults?: Array<{
      entityType?: string
      hash?: number
      displayProperties?: ManifestDisplayProperties
    }>
  }>(`/Destiny2/Armory/Search/${entityType}/${encoded}/?page=${page}`)

  const results = response?.searchResults ?? []
  return results
    .filter((r) => r.hash != null)
    .map((r) => ({
      hash: r.hash as number,
      name: r.displayProperties?.name ?? searchTerm,
      icon: r.displayProperties?.icon,
    }))
}

/** Public — no OAuth required. */
export async function getDestinyManifest() {
  return bungieFetch<{ jsonWorldContentPaths: { en: string } }>('/Destiny2/Manifest/')
}

/** Resolve a player by Bungie global display name + code (Phase 2). */
export async function searchPlayer(displayName: string, displayNameCode: number) {
  const encoded = encodeURIComponent(displayName)
  return bungieFetch<{
    Response?: Array<{
      membershipId: string
      membershipType: number
      displayName: string
    }>
  }>(`/User/Search/GlobalName/${encoded}/${displayNameCode}/`)
}

/** Profile + characters — requires membershipType + membershipId. */
export async function getPlayerProfile(
  membershipType: number,
  membershipId: string,
  components: number[] = [100, 200]
) {
  const componentQuery = components.join(',')
  return bungieFetch(
    `/Destiny2/${membershipType}/Profile/${membershipId}/?components=${componentQuery}`
  )
}

/** Character equipment / loadout — component 205 = CharacterEquipment. */
export async function getCharacterLoadout(
  membershipType: number,
  membershipId: string,
  characterId: string
) {
  return bungieFetch(
    `/Destiny2/${membershipType}/Profile/${membershipId}/Character/${characterId}/?components=205,201,202,204`
  )
}

/** Activity history for a character. */
export async function getActivityHistory(
  membershipType: number,
  membershipId: string,
  characterId: string,
  mode: number,
  count = 25
) {
  return bungieFetch(
    `/Destiny2/${membershipType}/Account/${membershipId}/Character/${characterId}/Stats/Activities/?mode=${mode}&count=${count}`
  )
}

/** Post-game carnage report — core for run verification. */
export async function getPostGameCarnageReport(activityId: string) {
  return bungieFetch(`/Destiny2/Stats/PostGameCarnageReport/${activityId}/`)
}

/** Clan info. */
export async function getClan(clanId: string) {
  return bungieFetch(`/GroupV2/${clanId}/`)
}

/** Clan members. */
export async function getClanMembers(clanId: string) {
  return bungieFetch(`/GroupV2/${clanId}/Members/`)
}

/** Fireteam / group roster for an activity instance (when available). */
export async function getActivityHistoryInstance(
  membershipType: number,
  membershipId: string,
  instanceId: string
) {
  return bungieFetch(
    `/Destiny2/Stats/PostGameCarnageReport/${instanceId}/`
  )
}

/**
 * Equip loadout — only where Bungie API supports it (requires OAuth + appropriate scopes).
 * Returns null with reason when not supported in current phase.
 */
export async function equipLoadoutItem(
  _membershipType: number,
  _membershipId: string,
  _characterId: string,
  _itemInstanceId: string,
  _accessToken?: string
): Promise<{ supported: false; reason: string }> {
  return {
    supported: false,
    reason:
      'Direct equip requires Bungie OAuth with inventory write scope. Use view/copy in Loadouts until OAuth is connected.',
  }
}

export function bungieMembershipTypeLabel(type: number): string {
  switch (type) {
    case 1:
      return 'xbox'
    case 2:
      return 'playstation'
    case 3:
      return 'steam'
    case 4:
      return 'battle.net'
    case 5:
      return 'stadia'
    case 6:
      return 'epic'
    default:
      return 'unknown'
  }
}

export async function checkBungieApiHealth(): Promise<{
  configured: boolean
  reachable: boolean
  message: string
}> {
  if (!destinyApiKey()) {
    return {
      configured: false,
      reachable: false,
      message: 'DESTINY_API is not set. Add your Bungie API key in Vercel env vars.',
    }
  }
  try {
    await getDestinyManifest()
    return {
      configured: true,
      reachable: true,
      message: 'Bungie API connected.',
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return {
      configured: true,
      reachable: false,
      message: `Bungie API key set but request failed: ${msg}`,
    }
  }
}
