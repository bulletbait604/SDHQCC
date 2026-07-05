import type {
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

export { PROFILE_FLEX_STAT_IDS }
export type { ProfileFlexStatId, ProfileFlexStat }

export const DEFAULT_PROFILE_FLEX_STATS: ProfileFlexStatId[] = [
  'guardian_rank',
  'power_level',
  'verified_clears',
  'fastest_clear',
]

export const MAX_PROFILE_FLEX_STATS = 4

export const FLEX_STAT_LABELS: Record<ProfileFlexStatId, string> = {
  guardian_rank: 'Guardian rank',
  power_level: 'Power level',
  raid_points: 'Raid points',
  dungeon_points: 'Dungeon points',
  verified_clears: 'Verified clears',
  fastest_clear: 'Fastest clear',
  reputation: 'Reputation',
  season_rank: 'Season rank',
}

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

  const values: Record<ProfileFlexStatId, ProfileFlexStat> = {
    guardian_rank: {
      id: 'guardian_rank',
      label: FLEX_STAT_LABELS.guardian_rank,
      value: String(profile.guardianRank ?? 0),
    },
    power_level: {
      id: 'power_level',
      label: FLEX_STAT_LABELS.power_level,
      value: String(profile.powerLevel ?? 0),
    },
    raid_points: {
      id: 'raid_points',
      label: FLEX_STAT_LABELS.raid_points,
      value: String(profile.raidPoints),
    },
    dungeon_points: {
      id: 'dungeon_points',
      label: FLEX_STAT_LABELS.dungeon_points,
      value: String(profile.dungeonPoints),
    },
    verified_clears: {
      id: 'verified_clears',
      label: FLEX_STAT_LABELS.verified_clears,
      value: String(profile.verifiedClears),
    },
    fastest_clear: {
      id: 'fastest_clear',
      label: FLEX_STAT_LABELS.fastest_clear,
      value: fastest ? formatSeconds(fastest.durationSeconds) : '—',
      detail: fastest?.activityName,
    },
    reputation: {
      id: 'reputation',
      label: FLEX_STAT_LABELS.reputation,
      value: profile.reputationScore > 0 ? profile.reputationScore.toFixed(1) : '—',
    },
    season_rank: {
      id: 'season_rank',
      label: FLEX_STAT_LABELS.season_rank,
      value: seasonRank ? `#${seasonRank.rank}` : '—',
      detail: seasonRank
        ? `${seasonRank.category.replace(/_/g, ' ')} · ${seasonRank.points} pts`
        : undefined,
    },
  }

  return preferences.map((id) => values[id]).filter(Boolean)
}
