import { gw2Get, gw2GetOk } from './client'
import { TYRIA_CONTINENT_ID, TYRIA_FLOOR_ID } from './mapConstants'
import { collectMapResources } from './mapResources'
import { poolMap } from './pool'
import {
  countByKind,
  parseHeroPointIdList,
  parseMasteryUnlocked,
  unionHeroPointIds,
} from './progress'
import type { Gw2ContinentInfo, Gw2ResourceKind, HeroPointTrackerPayload } from './types'
import { GW2_RESOURCE_KINDS } from './types'

type ContinentJson = {
  id?: number
  name?: string
  continent_dims?: number[]
  min_zoom?: number
  max_zoom?: number
}

type TokenInfo = { name?: string; permissions?: string[] }
type AccountInfo = { name?: string }

export const GW2_REQUIRED_SCOPES = ['account', 'characters', 'progression'] as const

export class Gw2KeyValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Gw2KeyValidationError'
  }
}

const FLOOR_TTL_MS = 6 * 60 * 60 * 1000
let floorCache: {
  at: number
  v: number
  points: HeroPointTrackerPayload['points']
  continent: Gw2ContinentInfo
} | null = null

function encodeCharacterName(name: string): string {
  return encodeURIComponent(name)
}

async function loadContinentAndPoints(): Promise<{
  continent: Gw2ContinentInfo
  points: HeroPointTrackerPayload['points']
}> {
  const now = Date.now()
  if (floorCache && floorCache.v === 2 && now - floorCache.at < FLOOR_TTL_MS) {
    return { continent: floorCache.continent, points: floorCache.points }
  }
  const continentJson = await gw2Get<ContinentJson>(`/continents/${TYRIA_CONTINENT_ID}`)
  const dims = continentJson.continent_dims || [81920, 114688]
  const continent: Gw2ContinentInfo = {
    id: TYRIA_CONTINENT_ID,
    name: typeof continentJson.name === 'string' ? continentJson.name : 'Tyria',
    floor: TYRIA_FLOOR_ID,
    dims: [Number(dims[0]) || 81920, Number(dims[1]) || 114688],
    minZoom: typeof continentJson.min_zoom === 'number' ? continentJson.min_zoom : 0,
    maxZoom: typeof continentJson.max_zoom === 'number' ? continentJson.max_zoom : 7,
  }
  const floor = await gw2Get<unknown>(`/continents/${TYRIA_CONTINENT_ID}/floors/${TYRIA_FLOOR_ID}`)
  const points = collectMapResources(floor)
  floorCache = { at: now, v: 2, points, continent }
  return { continent, points }
}

async function completedResourceIds(key: string): Promise<{
  ids: string[]
  characterCount: number
  accountName: string | null
  progressAvailable: boolean
  note?: string
}> {
  const token = await gw2Get<TokenInfo>('/tokeninfo', key)
  const perms = new Set((token.permissions || []).map((p) => p.toLowerCase()))
  const missing = GW2_REQUIRED_SCOPES.filter((p) => !perms.has(p))
  const account = await gw2GetOk<AccountInfo>('/account', key)
  const accountName = account && typeof account.name === 'string' ? account.name : null

  if (missing.length) {
    return {
      ids: [],
      characterCount: 0,
      accountName,
      progressAvailable: false,
      note: `This ArenaNet API key is missing scopes: ${missing.join(', ')}. Create a key with account, characters, and progression.`,
    }
  }

  const notes: string[] = []
  const names = await gw2Get<string[]>('/characters', key)
  const list = Array.isArray(names) ? names.filter((n) => typeof n === 'string' && n.trim()) : []
  let heroIds: string[] = []
  if (!list.length) {
    notes.push('No characters found on this ArenaNet API key, so hero-point progress is empty.')
  } else {
    const lists = await poolMap(list, 4, async (name) => {
      const raw = await gw2GetOk<unknown>(`/characters/${encodeCharacterName(name)}/heropoints`, key)
      return parseHeroPointIdList(raw)
    })
    heroIds = unionHeroPointIds(lists)
    if (!heroIds.length) {
      notes.push(
        'ArenaNet currently returns empty hero-point progress. Those markers stay Not Completed until the API reports them.'
      )
    }
  }

  const masteryRaw = await gw2GetOk<unknown>('/account/mastery/points', key)
  const masteryIds = parseMasteryUnlocked(masteryRaw)
  if (!masteryIds.length) {
    notes.push('No unlocked mastery insights were returned for this account.')
  }

  const ids = unionHeroPointIds([heroIds, masteryIds])
  return {
    ids,
    characterCount: list.length,
    accountName,
    progressAvailable: ids.length > 0,
    note: notes.length ? notes.join(' ') : undefined,
  }
}

export async function loadHeroPointTracker(
  apiKey: string | null,
  keySource: HeroPointTrackerPayload['keySource'] = apiKey ? 'user' : 'none'
): Promise<HeroPointTrackerPayload> {
  const { continent, points } = await loadContinentAndPoints()
  const key = (apiKey || '').trim() || null
  if (!key) {
    return {
      continent,
      points,
      completedIds: [],
      completedCount: 0,
      totalCount: points.length,
      countsByKind: countByKind(points, new Set()),
      accountName: null,
      characterCount: 0,
      keyConfigured: false,
      keySource: 'none',
      linkedKey: null,
      progressAvailable: false,
      note: 'Paste your ArenaNet API here to track hero points, mastery insights, and achievements for this Kick account. The key is encrypted and never shown to anyone else.',
    }
  }

  const progress = await completedResourceIds(key)
  const done = new Set(progress.ids)
  const countsByKind = countByKind(points, done)
  let completedCount = 0
  for (let i = 0; i < GW2_RESOURCE_KINDS.length; i += 1) {
    completedCount += countsByKind[GW2_RESOURCE_KINDS[i] as Gw2ResourceKind].completed
  }
  return {
    continent,
    points,
    completedIds: progress.ids,
    completedCount,
    totalCount: points.length,
    countsByKind,
    accountName: progress.accountName,
    characterCount: progress.characterCount,
    keyConfigured: true,
    keySource,
    linkedKey: null,
    progressAvailable: progress.progressAvailable,
    note: progress.note,
  }
}

export async function inspectGw2ApiKey(key: string): Promise<{
  tokenName: string | null
  accountName: string | null
  permissions: string[]
}> {
  const token = await gw2Get<TokenInfo>('/tokeninfo', key)
  const permissions = Array.isArray(token.permissions)
    ? token.permissions.filter((p): p is string => typeof p === 'string')
    : []
  const have = new Set(permissions.map((p) => p.toLowerCase()))
  const missing = GW2_REQUIRED_SCOPES.filter((p) => !have.has(p))
  if (missing.length) {
    throw new Gw2KeyValidationError(
      `This key is missing scopes: ${missing.join(', ')}. Create a key with account, characters, and progression.`
    )
  }
  const account = await gw2GetOk<AccountInfo>('/account', key)
  return {
    tokenName: typeof token.name === 'string' ? token.name : null,
    accountName: account && typeof account.name === 'string' ? account.name : null,
    permissions,
  }
}
