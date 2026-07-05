/**
 * Enrich DestinyTopNest API payloads with Bungie manifest icons.
 */

import type {
  BuildIntelligenceCard,
  BuildSnapshot,
  ClanProfile,
  FireteamLobby,
  LeaderboardEntry,
  OverviewPayload,
  PlayerProfile,
  RunRecord,
  WeeklyResetInfo,
} from '@/lib/destiny/types'
import {
  resolveActivity,
  resolveByName,
  resolveClassIcon,
  resolveEmblem,
  resolveSubclass,
  type DestinyIconRef,
} from '@/lib/destiny/manifest'
import { getWeeklyResetState } from '@/lib/destiny/weeklyRotation'

async function enrichBuildSnapshot(build: BuildSnapshot): Promise<BuildSnapshot> {
  const [
    classRef,
    subclassRef,
    exoticArmorRef,
    exoticWeaponRef,
    kineticRef,
    energyRef,
    powerRef,
    aspectRefs,
  ] = await Promise.all([
    resolveClassIcon(build.characterClass),
    resolveSubclass(build.subclass),
    resolveByName(build.exoticArmor),
    build.exoticWeapon ? resolveByName(build.exoticWeapon) : Promise.resolve(undefined),
    resolveByName(build.kineticWeapon),
    resolveByName(build.energyWeapon),
    resolveByName(build.powerWeapon),
    Promise.all(build.aspects.map((a) => resolveByName(a, 'DestinySandboxPerkDefinition'))),
  ])

  return {
    ...build,
    classRef,
    subclassRef,
    exoticArmorRef,
    exoticWeaponRef,
    kineticWeaponRef: kineticRef,
    energyWeaponRef: energyRef,
    powerWeaponRef: powerRef,
    aspectRefs,
  }
}

async function enrichBuildCard(card: BuildIntelligenceCard): Promise<BuildIntelligenceCard> {
  const [classRef, subclassRef, exoticArmorRef, exoticWeaponRef, weaponRefs] = await Promise.all([
    resolveClassIcon(card.characterClass),
    resolveSubclass(card.subclass),
    resolveByName(card.exoticArmor),
    card.exoticWeapon ? resolveByName(card.exoticWeapon) : Promise.resolve(undefined),
    Promise.all(card.weapons.map((w) => resolveByName(w))),
  ])

  const activityRef = await resolveActivity(card.activityName)

  return {
    ...card,
    classRef,
    subclassRef,
    exoticArmorRef,
    exoticWeaponRef,
    weaponRefs,
    activityRef,
  }
}

async function enrichLeaderboardEntry(entry: LeaderboardEntry, index: number): Promise<LeaderboardEntry> {
  const emblemUrl = entry.emblemUrl ?? (await resolveEmblem(index))
  return { ...entry, emblemUrl }
}

async function enrichLobby(lobby: FireteamLobby, index: number): Promise<FireteamLobby> {
  const [hostEmblemUrl, activityRef] = await Promise.all([
    lobby.hostEmblemUrl ?? resolveEmblem(index),
    resolveActivity(lobby.activityName),
  ])
  const classRef = lobby.hostClass ? await resolveClassIcon(lobby.hostClass) : undefined
  return { ...lobby, hostEmblemUrl, activityRef, hostClassRef: classRef }
}

export async function buildWeeklyResetInfo(): Promise<WeeklyResetInfo> {
  const state = getWeeklyResetState()
  const [raidIcons, dungeonIcons] = await Promise.all([
    Promise.all(state.featuredRaids.map((r) => resolveActivity(r.name))),
    Promise.all(state.featuredDungeons.map((d) => resolveActivity(d.name))),
  ])

  return {
    resetAt: state.resetAt,
    nextResetAt: state.nextResetAt,
    weekLabel: state.weekLabel,
    resetsInLabel: state.resetsInLabel,
    resetsInMs: state.resetsInMs,
    pantheon: state.pantheon,
    resetTimeLabel: state.resetTimeLabel,
    featuredRaids: state.featuredRaids.map((r, i) => ({
      ...r,
      hash: raidIcons[i]?.hash,
      iconUrl: raidIcons[i]?.iconUrl,
    })),
    featuredDungeons: state.featuredDungeons.map((d, i) => ({
      ...d,
      hash: dungeonIcons[i]?.hash,
      iconUrl: dungeonIcons[i]?.iconUrl,
    })),
  }
}

export async function enrichOverview(payload: OverviewPayload): Promise<OverviewPayload> {
  const weeklyReset = await buildWeeklyResetInfo()
  const primaryRaid = weeklyReset.featuredRaids[0]
  const primaryDungeon = weeklyReset.featuredDungeons[0]

  const [raidTop10, dungeonTop10, clanTop5, recentRuns, lookingForGroup, trendingBuilds] =
    await Promise.all([
      Promise.all(payload.raidTop10.map((e, i) => enrichLeaderboardEntry(e, i))),
      Promise.all(payload.dungeonTop10.map((e, i) => enrichLeaderboardEntry(e, i + 10))),
      Promise.all(payload.clanTop5.map((e, i) => enrichLeaderboardEntry(e, i + 20))),
      Promise.all(
        payload.recentRuns.map(async (run) => {
          const activityRef = await resolveActivity(run.activityName)
          return { ...run, activityRef }
        })
      ),
      Promise.all(payload.lookingForGroup.map((l, i) => enrichLobby(l, i))),
      Promise.all(payload.trendingBuilds.map(enrichBuildCard)),
    ])

  return {
    ...payload,
    weeklyReset,
    featuredRaid: {
      name: primaryRaid?.name ?? payload.featuredRaid.name,
      difficulty: primaryRaid?.difficulty ?? payload.featuredRaid.difficulty,
      resetsIn: weeklyReset.resetsInLabel,
      hash: primaryRaid?.hash,
      iconUrl: primaryRaid?.iconUrl,
    },
    featuredDungeon: {
      name: primaryDungeon?.name ?? payload.featuredDungeon.name,
      difficulty: primaryDungeon?.difficulty ?? payload.featuredDungeon.difficulty,
      resetsIn: weeklyReset.resetsInLabel,
      hash: primaryDungeon?.hash,
      iconUrl: primaryDungeon?.iconUrl,
    },
    raidTop10,
    dungeonTop10,
    clanTop5,
    recentRuns,
    lookingForGroup,
    trendingBuilds,
  }
}

export async function enrichProfile(profile: PlayerProfile): Promise<PlayerProfile> {
  const emblemUrl = profile.emblemUrl ?? (await resolveEmblem(0))
  const currentLoadout = profile.currentLoadout
    ? await enrichBuildSnapshot(profile.currentLoadout)
    : undefined
  const classRef = profile.characterClass
    ? await resolveClassIcon(profile.characterClass)
    : undefined

  return {
    ...profile,
    emblemUrl,
    classRef,
    currentLoadout,
  }
}

export async function enrichClan(clan: ClanProfile): Promise<ClanProfile> {
  const emblemUrl = clan.emblemUrl ?? (await resolveEmblem(2))
  const topMembers = await Promise.all(
    clan.topMembers.map(async (m, i) => ({
      ...m,
      emblemUrl: m.emblemUrl ?? (await resolveEmblem(i + 3)),
    }))
  )
  return { ...clan, emblemUrl, topMembers }
}

export async function enrichLoadoutsResponse(data: {
  current: BuildSnapshot
  saved: BuildSnapshot[]
  favorites: BuildSnapshot[]
  equipSupported: boolean
  equipMessage: string
}) {
  const [current, saved, favorites] = await Promise.all([
    enrichBuildSnapshot(data.current),
    Promise.all(data.saved.map(enrichBuildSnapshot)),
    Promise.all(data.favorites.map(enrichBuildSnapshot)),
  ])
  return { ...data, current, saved, favorites }
}

export async function enrichBuildsResponse(data: {
  verifiedBuilds: BuildIntelligenceCard[]
  externalBuilds: unknown[]
  aiSummary: string
  activity: string
}) {
  const verifiedBuilds = await Promise.all(data.verifiedBuilds.map(enrichBuildCard))
  return { ...data, verifiedBuilds }
}

export async function enrichLobbies(lobbies: FireteamLobby[]): Promise<FireteamLobby[]> {
  return Promise.all(lobbies.map((l, i) => enrichLobby(l, i)))
}

export type { DestinyIconRef }
