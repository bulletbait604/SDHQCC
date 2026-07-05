/**
 * Enrich DestinyTopNest API payloads with Bungie manifest icons.
 */

import type {
  BuildIntelligenceCard,
  BuildSnapshot,
  ClanProfile,
  ExternalBuildSource,
  FireteamLobby,
  LeaderboardEntry,
  OverviewPayload,
  PlayerProfile,
  RunRecord,
  WeeklyResetInfo,
} from '@/lib/destiny/types'
import {
  resolveActivity,
  resolveActivityRef,
  resolveByName,
  resolveClassIcon,
  resolveSubclass,
  type DestinyIconRef,
} from '@/lib/destiny/manifest'
import { activityCatalogLookup } from '@/lib/destiny/activityCatalog'
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
    fragmentRefs,
    superRef,
    classAbilityRef,
    jumpRef,
    meleeRef,
    grenadeRef,
  ] = await Promise.all([
    build.classRef ?? resolveClassIcon(build.characterClass),
    build.subclassRef ?? resolveSubclass(build.subclass),
    resolveByName(build.exoticArmor),
    build.exoticWeapon ? resolveByName(build.exoticWeapon) : Promise.resolve(undefined),
    resolveByName(build.kineticWeapon),
    resolveByName(build.energyWeapon),
    resolveByName(build.powerWeapon),
    build.aspectRefs?.length
      ? Promise.resolve(build.aspectRefs)
      : Promise.all(build.aspects.map((a) => resolveByName(a, 'DestinySandboxPerkDefinition'))),
    build.fragmentRefs?.length
      ? Promise.resolve(build.fragmentRefs)
      : Promise.all(build.fragments.map((f) => resolveByName(f, 'DestinySandboxPerkDefinition'))),
    build.superRef ?? (build.super !== '—' ? resolveByName(build.super) : Promise.resolve(undefined)),
    build.classAbilityRef ??
      (build.abilities[1] ? resolveByName(build.abilities[1]) : Promise.resolve(undefined)),
    build.jumpRef ??
      (build.abilities[2] ? resolveByName(build.abilities[2]) : Promise.resolve(undefined)),
    build.meleeRef ??
      (build.abilities[3] ? resolveByName(build.abilities[3]) : Promise.resolve(undefined)),
    build.grenadeRef ??
      (build.abilities[4] ? resolveByName(build.abilities[4]) : Promise.resolve(undefined)),
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
    fragmentRefs,
    superRef,
    classAbilityRef,
    jumpRef,
    meleeRef,
    grenadeRef,
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

  const activityRef = await resolveActivityRef(card.activityName, card.activityId)

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

async function enrichLeaderboardEntry(entry: LeaderboardEntry): Promise<LeaderboardEntry> {
  const fastestActivityRef = entry.fastestActivityName
    ? await resolveActivity(entry.fastestActivityName)
    : undefined
  return { ...entry, emblemUrl: entry.emblemUrl, fastestActivityRef }
}

async function enrichLobby(lobby: FireteamLobby): Promise<FireteamLobby> {
  const activityRef = await resolveActivity(lobby.activityName)
  const classRef = lobby.hostClass ? await resolveClassIcon(lobby.hostClass) : undefined
  return { ...lobby, activityRef, hostClassRef: classRef }
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
      hash: raidIcons[i]?.hash ?? activityCatalogLookup(r.name)?.hash,
      iconUrl: raidIcons[i]?.iconUrl,
    })),
    featuredDungeons: state.featuredDungeons.map((d, i) => ({
      ...d,
      hash: dungeonIcons[i]?.hash ?? activityCatalogLookup(d.name)?.hash,
      iconUrl: dungeonIcons[i]?.iconUrl,
    })),
  }
}

export async function enrichOverview(payload: OverviewPayload): Promise<OverviewPayload> {
  const weeklyReset = await buildWeeklyResetInfo()
  const primaryRaid = weeklyReset.featuredRaids[0]
  const primaryDungeon = weeklyReset.featuredDungeons[0]

  const [raidTop10, dungeonTop10, clanTop5, recentRuns, lookingForGroup, trendingBuilds, topLoadoutsByClass] =
    await Promise.all([
      Promise.all(payload.raidTop10.map(enrichLeaderboardEntry)),
      Promise.all(payload.dungeonTop10.map(enrichLeaderboardEntry)),
      Promise.all(payload.clanTop5.map(enrichLeaderboardEntry)),
      Promise.all(
        payload.recentRuns.map(async (run) => {
          const activityRef = await resolveActivityRef(run.activityName, run.activityId)
          return { ...run, activityRef }
        })
      ),
      Promise.all(payload.lookingForGroup.map(enrichLobby)),
      Promise.all(payload.trendingBuilds.map(enrichBuildCard)),
      Promise.all(
        (['titan', 'hunter', 'warlock'] as const).map(async (cls) =>
          Promise.all((payload.topLoadoutsByClass[cls] ?? []).map(enrichBuildCard))
        )
      ).then(([titan, hunter, warlock]) => ({ titan, hunter, warlock })),
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
    topLoadoutsByClass,
  }
}

export async function enrichProfile(profile: PlayerProfile): Promise<PlayerProfile> {
  const currentLoadout = profile.currentLoadout
    ? await enrichBuildSnapshot(profile.currentLoadout)
    : undefined
  const classRef = profile.characterClass
    ? await resolveClassIcon(profile.characterClass)
    : undefined
  const recentRuns = await Promise.all(
    profile.recentRuns.map(async (run) => ({
      ...run,
      activityRef: await resolveActivityRef(run.activityName, run.activityId),
    }))
  )

  return {
    ...profile,
    classRef,
    currentLoadout,
    recentRuns,
  }
}

export async function enrichClan(clan: ClanProfile): Promise<ClanProfile> {
  return { ...clan }
}

export async function enrichLoadoutsResponse(data: {
  current: BuildSnapshot | null
  saved: BuildSnapshot[]
  favorites: BuildSnapshot[]
  equipSupported: boolean
  equipMessage: string
}) {
  if (!data.current) {
    return { ...data, current: null, saved: [], favorites: [] }
  }
  const [current, saved, favorites] = await Promise.all([
    enrichBuildSnapshot(data.current),
    Promise.all(data.saved.map(enrichBuildSnapshot)),
    Promise.all(data.favorites.map(enrichBuildSnapshot)),
  ])
  return { ...data, current, saved, favorites }
}

async function enrichExternalBuild(build: ExternalBuildSource): Promise<ExternalBuildSource> {
  const [classRef, subclassRef, exoticArmorRef, exoticWeaponRef, weaponRefs, activityRef] =
    await Promise.all([
      resolveClassIcon(build.class),
      resolveSubclass(build.subclass),
      build.exoticArmor ? resolveByName(build.exoticArmor) : Promise.resolve(undefined),
      build.exoticWeapon ? resolveByName(build.exoticWeapon) : Promise.resolve(undefined),
      Promise.all((build.weapons ?? []).map((w) => resolveByName(w))),
      build.activityFocus ? resolveActivity(build.activityFocus) : Promise.resolve(undefined),
    ])

  return {
    ...build,
    classRef,
    subclassRef,
    exoticArmorRef,
    exoticWeaponRef,
    weaponRefs,
    activityRef,
  }
}

export async function enrichBuildsResponse(data: {
  verifiedBuilds: BuildIntelligenceCard[]
  externalBuilds: ExternalBuildSource[]
  aiSummary: string
  metaResearchSummary?: string
  activity: string
}) {
  const [verifiedBuilds, externalBuilds] = await Promise.all([
    Promise.all(data.verifiedBuilds.map(enrichBuildCard)),
    Promise.all(data.externalBuilds.map(enrichExternalBuild)),
  ])
  return { ...data, verifiedBuilds, externalBuilds }
}

export async function enrichLobbies(lobbies: FireteamLobby[]): Promise<FireteamLobby[]> {
  return Promise.all(lobbies.map(enrichLobby))
}

export type { DestinyIconRef }
