import {
  getCharacterLoadout,
  getClan,
  getClanMembers,
  getGroupsForMember,
  getPlayerProfile,
} from '@/lib/destiny/bungieClient'
import { fetchGuardianPresentation } from '@/lib/destiny/guardianPresentation'
import type { StoredDestinyUser } from '@/lib/destiny/destinyUserStore'
import { getValidAccessToken, upsertDestinyUser } from '@/lib/destiny/destinyUserStore'
import { resolveInventoryItem } from '@/lib/destiny/manifest'
import type {
  BuildSnapshot,
  ClanProfile,
  DestinyCharacterClass,
  PlayerProfile,
} from '@/lib/destiny/types'

const CLASS_MAP: Record<number, DestinyCharacterClass> = {
  0: 'titan',
  1: 'hunter',
  2: 'warlock',
}

const WEAPON_BUCKETS: Record<number, 'kinetic' | 'energy' | 'power'> = {
  1498876634: 'kinetic',
  2465295065: 'energy',
  953998645: 'power',
}

async function resolveItemName(hash: number, fallback: string): Promise<string> {
  const info = await resolveInventoryItem(hash, fallback)
  return info.name
}

export async function refreshGuardianFromBungie(stored: StoredDestinyUser): Promise<StoredDestinyUser> {
  const accessToken = await getValidAccessToken(stored)
  const membershipType = stored.destinyMembershipType
  const membershipId = stored.bungieMembershipId
  if (!accessToken || !membershipType || !membershipId) return stored

  try {
    const presentation = await fetchGuardianPresentation(
      membershipType,
      membershipId,
      accessToken,
      stored.bungieDisplayName
    )
    if (!presentation) return stored

    const updated = await upsertDestinyUser(stored.userId, {
      emblemUrl: presentation.emblemUrl,
      emblemBackgroundUrl: presentation.emblemBackgroundUrl,
      emblemColor: presentation.emblemColor,
      characterThumbnailUrl: presentation.characterThumbnailUrl,
      activeCharacterId: presentation.characterId,
      guardianRank: presentation.guardianRank,
      powerLevel: presentation.powerLevel,
      characterClass: presentation.characterClass,
      bungieDisplayName: stored.bungieDisplayName || presentation.displayName,
    })
    return updated
  } catch {
    return stored
  }
}

export async function fetchLiveLoadout(stored: StoredDestinyUser): Promise<BuildSnapshot | null> {
  const accessToken = await getValidAccessToken(stored)
  const membershipType = stored.destinyMembershipType
  const membershipId = stored.bungieMembershipId
  if (!accessToken || !membershipType || !membershipId) return null

  const profile = (await getPlayerProfile(membershipType, membershipId, [200], accessToken)) as {
    characters?: { data?: Record<string, { classType?: number; light?: number }> }
  }

  const chars = profile.characters?.data ?? {}
  const characterId = Object.entries(chars).sort(([, a], [, b]) => (b.light ?? 0) - (a.light ?? 0))[0]?.[0]
  if (!characterId) return null

  const classType = chars[characterId]?.classType ?? 1
  const characterClass = CLASS_MAP[classType] ?? 'hunter'

  const loadout = (await getCharacterLoadout(membershipType, membershipId, characterId, accessToken)) as {
    equipment?: { data?: { items?: Array<{ itemHash?: number; bucketHash?: number }> } }
  }

  const items = loadout.equipment?.data?.items ?? []
  const weapons: Record<string, string> = {}
  let exoticArmor = 'Unknown exotic'
  let exoticWeapon: string | undefined

  for (const item of items) {
    if (!item.itemHash || !item.bucketHash) continue
    const name = await resolveItemName(item.itemHash, `Item ${item.itemHash}`)
    const slot = WEAPON_BUCKETS[item.bucketHash]
    if (slot) {
      weapons[slot] = name
      if (name.toLowerCase().includes('exotic') || item.bucketHash === 953998645) {
        exoticWeapon = name
      }
    } else if (item.bucketHash === 14239492 || item.bucketHash === 20886954 || item.bucketHash === 1585787867) {
      exoticArmor = name
    }
  }

  return {
    id: `live-${characterId}`,
    runId: '',
    userId: stored.userId,
    characterClass,
    subclass: 'Unknown',
    super: '',
    aspects: [],
    fragments: [],
    abilities: [],
    exoticArmor,
    exoticWeapon,
    kineticWeapon: weapons.kinetic ?? '—',
    energyWeapon: weapons.energy ?? '—',
    powerWeapon: weapons.power ?? '—',
    armorMods: [],
    artifactPerks: [],
    stats: {},
    activityId: 0,
    activityName: 'Current loadout',
    difficulty: 'normal',
    completedAt: new Date().toISOString(),
    durationSeconds: 0,
    deaths: 0,
    fireteamComposition: 'solo',
  }
}

export async function fetchLiveClan(stored: StoredDestinyUser): Promise<ClanProfile | null> {
  const membershipType = stored.destinyMembershipType
  const membershipId = stored.bungieMembershipId
  if (!membershipType || !membershipId) return null

  if (stored.clanId) {
    return fetchClanById(stored.clanId, stored)
  }

  try {
    const groups = await getGroupsForMember(membershipType, membershipId)
    const clan = groups.results?.[0]?.group
    if (!clan?.groupId) return null

    await upsertDestinyUser(stored.userId, {
      clanId: clan.groupId,
      clanName: clan.name,
      clanTag: clan.clanInfo?.clanCallsign ? `[${clan.clanInfo.clanCallsign}]` : undefined,
    })

    return fetchClanById(clan.groupId, stored)
  } catch {
    return null
  }
}

async function fetchClanById(clanId: string, stored: StoredDestinyUser): Promise<ClanProfile | null> {
  try {
    const [clanData, membersData] = await Promise.all([
      getClan(clanId) as Promise<{
        detail?: { name?: string; motto?: string; memberCount?: number }
        clanInfo?: { clanCallsign?: string; clanBannerData?: { emblemPath?: string } }
      }>,
      getClanMembers(clanId) as Promise<{
        results?: Array<{ destMemberDisplayName?: string; memberType?: number }>
      }>,
    ])

    const tag = clanData.clanInfo?.clanCallsign ? `[${clanData.clanInfo.clanCallsign}]` : stored.clanTag ?? ''
    const emblemPath = clanData.clanInfo?.clanBannerData?.emblemPath
    const emblemUrl = emblemPath ? `https://www.bungie.net${emblemPath}` : undefined

    const topMembers =
      membersData.results?.slice(0, 5).map((m) => ({
        displayName: m.destMemberDisplayName ?? 'Member',
        points: 0,
      })) ?? []

    return {
      id: clanId,
      name: clanData.detail?.name ?? stored.clanName ?? 'Clan',
      tag,
      emblemUrl,
      memberCount: clanData.detail?.memberCount ?? topMembers.length,
      points: 0,
      fullClanClears: 0,
      recruitmentOpen: false,
      avgRaidClearSeconds: 0,
      avgDungeonClearSeconds: 0,
      topMembers,
      achievements: [],
    }
  } catch {
    return null
  }
}

export type { PlayerProfile }
