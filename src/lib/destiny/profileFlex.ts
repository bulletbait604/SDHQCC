import type {
  GuardianBungieStats,
  LeaderboardEntry,
  PlayerProfile,
  ProfileFlexStat,
  ProfileFlexStatId,
} from '@/lib/destiny/types'
import { PROFILE_FLEX_STAT_IDS } from '@/lib/destiny/types'

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  if (hours >= 100) return `${hours.toLocaleString()}h`
  return `${hours}h ${minutes % 60}m`
}

export { PROFILE_FLEX_STAT_IDS }
export type { ProfileFlexStatId, ProfileFlexStat }

export const DEFAULT_PROFILE_FLEX_STATS: ProfileFlexStatId[] = [
  'guardian_rank',
  'power_level',
  'bungie_fastest_raid',
  'bungie_raid_clears',
]

export const MAX_PROFILE_FLEX_STATS = 4

export const STAT_CARD_LABELS: Record<ProfileFlexStatId, string> = {
  guardian_rank: 'Guardian rank',
  power_level: 'Power level',
  bungie_fastest_raid: 'Fastest raid',
  bungie_fastest_dungeon: 'Fastest dungeon',
  bungie_raid_clears: 'Raid clears',
  bungie_dungeon_clears: 'Dungeon clears',
  bungie_kills: 'Lifetime kills',
  bungie_time_played: 'Time played',
  raid_points: 'Raid points',
  dungeon_points: 'Dungeon points',
  verified_clears: 'Verified clears',
  fastest_clear: 'Top Nest fastest',
  reputation: 'Reputation',
  season_rank: 'Season rank',
}

/** @deprecated use STAT_CARD_LABELS */
export const FLEX_STAT_LABELS = STAT_CARD_LABELS

export const STAT_CARD_GROUPS: { label: string; ids: ProfileFlexStatId[] }[] = [
  {
    label: 'Bungie live',
    ids: [
      'guardian_rank',
      'power_level',
      'bungie_fastest_raid',
      'bungie_fastest_dungeon',
      'bungie_raid_clears',
      'bungie_dungeon_clears',
      'bungie_kills',
      'bungie_time_played',
    ],
  },
  {
    label: 'Top Nest',
    ids: [
      'raid_points',
      'dungeon_points',
      'verified_clears',
      'fastest_clear',
      'reputation',
      'season_rank',
    ],
  },
]

export function sanitizeFlexPreferences(input: unknown): ProfileFlexStatId[] {
  if (!Array.isArray(input)) return [...DEFAULT_PROFILE_FLEX_STATS]
  const valid = input.filter(
    (id): id is ProfileFlexStatId =>
      typeof id === 'string' && PROFILE_FLEX_STAT_IDS.includes(id as ProfileFlexStatId)
  )
  return valid.length ? valid.slice(0, MAX_PROFILE_FLEX_STATS) : [...DEFAULT_PROFILE_FLEX_STATS]
}

function bestSeasonRank(entries: LeaderboardEntry[]) {
  if (!entries.length) return undefined
  return entries.reduce((best, entry) => (!best || entry.rank < best.rank ? entry : best))
}

export function buildProfileFlexStats(
  profile: PlayerProfile,
  preferences: ProfileFlexStatId[],
  seasonLeaderboardEntries: LeaderboardEntry[] = []
): ProfileFlexStat[] {
  const fastest = profile.topCompletions[0]
  const seasonRank = bestSeasonRank(seasonLeaderboardEntries)
  const bungie = profile.bungieStats

  const values: Record<ProfileFlexStatId, ProfileFlexStat> = {
    guardian_rank: {
      id: 'guardian_rank',
      label: STAT_CARD_LABELS.guardian_rank,
      value: String(profile.guardianRank ?? 0),
    },
    power_level: {
      id: 'power_level',
      label: STAT_CARD_LABELS.power_level,
      value: String(profile.powerLevel ?? 0),
    },
    bungie_fastest_raid: {
      id: 'bungie_fastest_raid',
      label: STAT_CARD_LABELS.bungie_fastest_raid,
      value: bungie?.fastestRaidSeconds ? formatSeconds(bungie.fastestRaidSeconds) : '—',
      detail: bungie?.fastestRaidName,
    },
    bungie_fastest_dungeon: {
      id: 'bungie_fastest_dungeon',
      label: STAT_CARD_LABELS.bungie_fastest_dungeon,
      value: bungie?.fastestDungeonSeconds ? formatSeconds(bungie.fastestDungeonSeconds) : '—',
      detail: bungie?.fastestDungeonName,
    },
    bungie_raid_clears: {
      id: 'bungie_raid_clears',
      label: STAT_CARD_LABELS.bungie_raid_clears,
      value: bungie?.raidClears != null ? String(bungie.raidClears) : '—',
      detail: 'Recent activity history',
    },
    bungie_dungeon_clears: {
      id: 'bungie_dungeon_clears',
      label: STAT_CARD_LABELS.bungie_dungeon_clears,
      value: bungie?.dungeonClears != null ? String(bungie.dungeonClears) : '—',
      detail: 'Recent activity history',
    },
    bungie_kills: {
      id: 'bungie_kills',
      label: STAT_CARD_LABELS.bungie_kills,
      value: bungie?.totalKills != null ? bungie.totalKills.toLocaleString() : '—',
      detail: bungie?.totalDeaths != null ? `${bungie.totalDeaths.toLocaleString()} deaths` : undefined,
    },
    bungie_time_played: {
      id: 'bungie_time_played',
      label: STAT_CARD_LABELS.bungie_time_played,
      value: bungie?.timePlayedMinutes ? formatHours(bungie.timePlayedMinutes) : '—',
    },
    raid_points: {
      id: 'raid_points',
      label: STAT_CARD_LABELS.raid_points,
      value: String(profile.raidPoints),
    },
    dungeon_points: {
      id: 'dungeon_points',
      label: STAT_CARD_LABELS.dungeon_points,
      value: String(profile.dungeonPoints),
    },
    verified_clears: {
      id: 'verified_clears',
      label: STAT_CARD_LABELS.verified_clears,
      value: String(profile.verifiedClears),
    },
    fastest_clear: {
      id: 'fastest_clear',
      label: STAT_CARD_LABELS.fastest_clear,
      value: fastest ? formatSeconds(fastest.durationSeconds) : '—',
      detail: fastest?.activityName,
    },
    reputation: {
      id: 'reputation',
      label: STAT_CARD_LABELS.reputation,
      value: profile.reputationScore > 0 ? profile.reputationScore.toFixed(1) : '—',
    },
    season_rank: {
      id: 'season_rank',
      label: STAT_CARD_LABELS.season_rank,
      value: seasonRank ? `#${seasonRank.rank}` : '—',
      detail: seasonRank
        ? `${seasonRank.category.replace(/_/g, ' ')} · ${seasonRank.points} pts`
        : undefined,
    },
  }

  return preferences.map((id) => values[id]).filter(Boolean)
}
