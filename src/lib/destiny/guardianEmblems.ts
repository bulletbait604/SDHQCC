/**
 * Fetch and resolve guardian emblems from Bungie (equipped + collection).
 */

import { getPlayerProfile, getDestinyEntityDefinition } from '@/lib/destiny/bungieClient'
import { buildBungieIconUrl } from '@/lib/destiny/bungieUrls'
import { emblemUrlsFromProfile } from '@/lib/destiny/guardianBuild'
import { resolveInventoryItem } from '@/lib/destiny/manifest'
import type { StoredDestinyUser } from '@/lib/destiny/destinyUserStore'
import { getValidAccessToken } from '@/lib/destiny/destinyUserStore'
import type { EmblemOption, ResolvedEmblem } from '@/lib/destiny/types'

/** Destiny 2 emblem inventory bucket. */
export const EMBLEM_BUCKET = 4274335291
/** Resolve emblem art from a manifest item hash. */
export async function resolveEmblemFromHash(itemHash: number): Promise<ResolvedEmblem> {
  try {
    const def = (await getDestinyEntityDefinition('DestinyInventoryItemDefinition', itemHash)) as {
      displayProperties?: { name?: string; icon?: string; secondaryOverlay?: string }
      secondaryOverlay?: string
    }
    const props = def.displayProperties
    const name = props?.name ?? `Emblem ${itemHash}`
    const iconUrl = buildBungieIconUrl(props?.icon)
    const backgroundUrl = buildBungieIconUrl(
      def.secondaryOverlay ?? props?.secondaryOverlay ?? props?.icon
    )
    return { itemHash, name, iconUrl, backgroundUrl, source: 'collection' }
  } catch {
    const info = await resolveInventoryItem(itemHash)
    return {
      itemHash,
      name: info.name,
      iconUrl: info.iconUrl,
      backgroundUrl: info.iconUrl,
      source: 'collection',
    }
  }
}

interface InventoryItem {
  itemHash?: number
  bucketHash?: number
}

function collectEmblemHashes(payload: {
  profileInventory?: { data?: { items?: InventoryItem[] } }
  characterInventories?: { data?: Record<string, { items?: InventoryItem[] }> }
}): number[] {
  const hashes = new Set<number>()
  const scan = (items?: InventoryItem[]) => {
    for (const item of items ?? []) {
      if (item.itemHash && item.bucketHash === EMBLEM_BUCKET) {
        hashes.add(item.itemHash)
      }
    }
  }
  scan(payload.profileInventory?.data?.items)
  for (const inv of Object.values(payload.characterInventories?.data ?? {})) {
    scan(inv.items)
  }
  return Array.from(hashes)
}

/** List emblems the player owns (profile + character inventories). */
export async function fetchOwnedEmblems(stored: StoredDestinyUser): Promise<EmblemOption[]> {
  const accessToken = await getValidAccessToken(stored)
  const membershipType = stored.destinyMembershipType
  const membershipId = stored.bungieMembershipId
  if (!accessToken || !membershipType || !membershipId) return []

  try {
    const profile = (await getPlayerProfile(
      membershipType,
      membershipId,
      [102, 201],
      accessToken
    )) as {
      profileInventory?: { data?: { items?: InventoryItem[] } }
      characterInventories?: { data?: Record<string, { items?: InventoryItem[] }> }
    }

    const hashes = collectEmblemHashes(profile)
    const resolved = await Promise.all(hashes.slice(0, 80).map((h) => resolveEmblemFromHash(h)))
    return resolved
      .filter((e) => e.iconUrl)
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

/** Equipped emblem on the active character (live from Bungie). */
export async function fetchEquippedEmblem(
  stored: StoredDestinyUser,
  characterId?: string
): Promise<ResolvedEmblem | null> {
  const accessToken = await getValidAccessToken(stored)
  const membershipType = stored.destinyMembershipType
  const membershipId = stored.bungieMembershipId
  if (!accessToken || !membershipType || !membershipId) return null

  try {
    const profile = (await getPlayerProfile(membershipType, membershipId, [200], accessToken)) as {
      characters?: {
        data?: Record<
          string,
          {
            light?: number
            emblemPath?: string
            emblemBackgroundPath?: string
            emblemColor?: { red?: number; green?: number; blue?: number; alpha?: number }
          }
        >
      }
    }

    const chars = profile.characters?.data ?? {}
    const cid =
      characterId && chars[characterId]
        ? characterId
        : Object.entries(chars).sort(([, a], [, b]) => (b.light ?? 0) - (a.light ?? 0))[0]?.[0]

    if (!cid) return null

    const urls = emblemUrlsFromProfile(profile, cid)
    if (!urls.emblemUrl && !urls.emblemBackgroundUrl) return null

    return {
      name: 'Equipped emblem',
      iconUrl: urls.emblemUrl,
      backgroundUrl: urls.emblemBackgroundUrl,
      color: urls.emblemColor,
      source: 'equipped',
      characterId: cid,
    }
  } catch {
    return null
  }
}

/** Pick which emblem to show on cards (equipped default, or user-selected collection piece). */
export async function resolveDisplayEmblem(stored: StoredDestinyUser): Promise<ResolvedEmblem | null> {
  const equipped = await fetchEquippedEmblem(stored, stored.activeCharacterId)
  const source = stored.displayEmblemSource ?? 'equipped'

  if (source === 'collection' && stored.displayEmblemHash) {
    const picked = await resolveEmblemFromHash(stored.displayEmblemHash)
    if (picked.iconUrl) return picked
  }

  if (equipped) return equipped

  if (stored.emblemUrl || stored.emblemBackgroundUrl) {
    return {
      name: 'Emblem',
      iconUrl: stored.emblemUrl,
      backgroundUrl: stored.emblemBackgroundUrl,
      color: stored.emblemColor,
      source: 'equipped',
    }
  }

  return null
}
