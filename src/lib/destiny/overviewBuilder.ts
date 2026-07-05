import { getWeeklyResetState } from '@/lib/destiny/weeklyRotation'
import { destinyApiConfigured } from '@/lib/destiny/env'
import {
  ACTIVE_SEASON,
  getSeasonCountdown,
  PRIZE_SUMMARY,
} from '@/lib/destiny/seasonConfig'
import type { OverviewPayload } from '@/lib/destiny/types'
import type { TopLoadoutsByClass } from '@/lib/destiny/loadoutRankings'

export function buildOverviewPayload(input: {
  raidTop10: OverviewPayload['raidTop10']
  dungeonTop10: OverviewPayload['dungeonTop10']
  clanTop5: OverviewPayload['clanTop5']
  recentRuns: OverviewPayload['recentRuns']
  lookingForGroup: OverviewPayload['lookingForGroup']
  trendingBuilds: OverviewPayload['trendingBuilds']
  topLoadoutsByClass: TopLoadoutsByClass
}): OverviewPayload {
  const weekly = getWeeklyResetState()
  const primaryRaid = weekly.featuredRaids[0]
  const primaryDungeon = weekly.featuredDungeons[0]

  return {
    raidTop10: input.raidTop10,
    dungeonTop10: input.dungeonTop10,
    clanTop5: input.clanTop5,
    recentRuns: input.recentRuns,
    weeklyReset: {
      resetAt: weekly.resetAt,
      nextResetAt: weekly.nextResetAt,
      weekLabel: weekly.weekLabel,
      resetsInLabel: weekly.resetsInLabel,
      resetsInMs: weekly.resetsInMs,
      pantheon: weekly.pantheon,
      resetTimeLabel: weekly.resetTimeLabel,
      featuredRaids: weekly.featuredRaids.map((r) => ({ ...r })),
      featuredDungeons: weekly.featuredDungeons.map((d) => ({ ...d })),
    },
    featuredRaid: {
      name: primaryRaid?.name ?? 'Featured Raid',
      difficulty: primaryRaid?.difficulty ?? 'normal',
      resetsIn: weekly.resetsInLabel,
    },
    featuredDungeon: {
      name: primaryDungeon?.name ?? 'Featured Dungeon',
      difficulty: primaryDungeon?.difficulty ?? 'normal',
      resetsIn: weekly.resetsInLabel,
    },
    season: ACTIVE_SEASON,
    seasonCountdown: getSeasonCountdown(),
    prizeSummary: PRIZE_SUMMARY,
    lookingForGroup: input.lookingForGroup,
    trendingBuilds: input.trendingBuilds,
    topLoadoutsByClass: input.topLoadoutsByClass,
    bungieApiConfigured: destinyApiConfigured(),
  }
}
