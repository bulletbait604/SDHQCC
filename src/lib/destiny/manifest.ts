/**
 * Bungie manifest icon resolution with Mongo cache.
 */

import clientPromise from '@/lib/mongodb'
import {
  getDestinyEntityDefinition,
  searchDestinyEntities,
  type ManifestDisplayProperties,
} from '@/lib/destiny/bungieClient'
import { catalogLookup, MOCK_EMBLEM_HASHES, type ManifestEntityType } from '@/lib/destiny/itemsCatalog'
import { destinyApiConfigured } from '@/lib/destiny/env'

const CACHE_COLLECTION = 'destiny_manifest_cache'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface DestinyIconRef {
  name: string
  hash?: number
  iconUrl?: string
  tierLabel?: string
  entityType?: ManifestEntityType
}

interface CacheDoc {
  _id: string
  hash: number
  entityType: ManifestEntityType
  name: string
  iconPath?: string
  iconUrl?: string
  tierLabel?: string
  cachedAt: string
}

export function buildBungieIconUrl(iconPath: string | undefined | null): string | undefined {
  if (!iconPath) return undefined
  if (iconPath.startsWith('http')) return iconPath
  return `https://www.bungie.net${iconPath.startsWith('/') ? '' : '/'}${iconPath}`
}

function cacheId(entityType: ManifestEntityType, hash: number): string {
  return `${entityType}:${hash}`
}

async function readCache(entityType: ManifestEntityType, hash: number): Promise<CacheDoc | null> {
  try {
    const client = await clientPromise
    const doc = await client.db('sdhq').collection(CACHE_COLLECTION).findOne({ _id: cacheId(entityType, hash) })
    if (!doc) return null
    const age = Date.now() - new Date(doc.cachedAt as string).getTime()
    if (age > CACHE_TTL_MS) return null
    return doc as unknown as CacheDoc
  } catch {
    return null
  }
}

async function writeCache(entry: CacheDoc): Promise<void> {
  try {
    const client = await clientPromise
    await client.db('sdhq').collection(CACHE_COLLECTION).updateOne(
      { _id: entry._id },
      { $set: entry },
      { upsert: true }
    )
  } catch {
    /* non-fatal */
  }
}

function propsFromDefinition(def: unknown): ManifestDisplayProperties | undefined {
  if (!def || typeof def !== 'object') return undefined
  return (def as { displayProperties?: ManifestDisplayProperties }).displayProperties
}

function tierFromDefinition(def: unknown): string | undefined {
  if (!def || typeof def !== 'object') return undefined
  return (def as { inventory?: { tierTypeName?: string } }).inventory?.tierTypeName
}

export async function resolveManifestHash(
  entityType: ManifestEntityType,
  hash: number,
  fallbackName: string
): Promise<DestinyIconRef> {
  const cached = await readCache(entityType, hash)
  if (cached?.iconUrl) {
    return {
      name: cached.name || fallbackName,
      hash,
      iconUrl: cached.iconUrl,
      tierLabel: cached.tierLabel,
      entityType,
    }
  }

  if (!destinyApiConfigured()) {
    return { name: fallbackName, hash, entityType }
  }

  try {
    const def = await getDestinyEntityDefinition(entityType, hash)
    const props = propsFromDefinition(def)
    const iconUrl = buildBungieIconUrl(props?.icon)
    const name = props?.name || fallbackName
    const tierLabel = tierFromDefinition(def)

    if (iconUrl) {
      await writeCache({
        _id: cacheId(entityType, hash),
        hash,
        entityType,
        name,
        iconPath: props?.icon,
        iconUrl,
        tierLabel,
        cachedAt: new Date().toISOString(),
      })
    }

    return { name, hash, iconUrl, tierLabel, entityType }
  } catch {
    return { name: fallbackName, hash, entityType }
  }
}

export async function resolveByName(
  name: string,
  preferredEntity: ManifestEntityType = 'DestinyInventoryItemDefinition'
): Promise<DestinyIconRef> {
  const catalog = catalogLookup(name)
  if (catalog) {
    return resolveManifestHash(catalog.entity, catalog.hash, name)
  }

  if (!destinyApiConfigured()) {
    return { name, entityType: preferredEntity }
  }

  try {
    const results = await searchDestinyEntities(preferredEntity, name)
    const first = results[0]
    if (first?.hash) {
      return resolveManifestHash(preferredEntity, first.hash, first.name || name)
    }
  } catch {
    /* fall through */
  }

  return { name, entityType: preferredEntity }
}

export async function resolveActivity(name: string): Promise<DestinyIconRef> {
  return resolveByName(name, 'DestinyActivityDefinition')
}

export async function resolveSubclass(name: string): Promise<DestinyIconRef> {
  const key = name.trim().toLowerCase()
  const damageKey = ['prismatic', 'arc', 'solar', 'void', 'strand', 'stasis'].find((k) => key.includes(k))
  if (damageKey) {
    const catalog = catalogLookup(damageKey)
    if (catalog) return resolveManifestHash(catalog.entity, catalog.hash, name)
  }
  return resolveByName(name, 'DestinyDamageTypeDefinition')
}

export async function resolveClassIcon(characterClass: string): Promise<DestinyIconRef> {
  const catalog = catalogLookup(characterClass)
  if (catalog) return resolveManifestHash(catalog.entity, catalog.hash, characterClass)
  return { name: characterClass }
}

export async function resolveEmblem(index: number): Promise<string | undefined> {
  const hash = MOCK_EMBLEM_HASHES[index % MOCK_EMBLEM_HASHES.length]
  const ref = await resolveManifestHash('DestinyInventoryItemDefinition', hash, 'Emblem')
  return ref.iconUrl
}

export async function resolveMany(names: string[], entity?: ManifestEntityType): Promise<DestinyIconRef[]> {
  return Promise.all(names.map((n) => resolveByName(n, entity)))
}
