import {
  getClan,
  getClanMembers,
  getGroupsForMember,
} from '@/lib/destiny/bungieClient'
import { fetchGuardianPresentation } from '@/lib/destiny/guardianPresentation'
import { fetchGuardianBungieStats } from '@/lib/destiny/guardianBungieStats'
import { fetchCharacterBuild } from '@/lib/destiny/guardianBuild'
import type { StoredDestinyUser } from '@/lib/destiny/destinyUserStore'
import { getValidAccessToken, upsertDestinyUser } from '@/lib/destiny/destinyUserStore'
import type {
  BuildSnapshot,
  ClanProfile,
  PlayerProfile,
} from '@/lib/destiny/types'

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

    const bungieStats = await fetchGuardianBungieStats(
      membershipType,
      membershipId,
      accessToken,
      presentation.characterId
    ).catch(() => stored.bungieStats ?? null)

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
      bungieStats: bungieStats ?? undefined,
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

  try {
    return await fetchCharacterBuild(
      membershipType,
      membershipId,
      accessToken,
      stored.userId,
      stored.activeCharacterId
    )
  } catch {
    return null
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
