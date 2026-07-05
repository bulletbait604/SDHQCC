import { aggregateClanLeaderboard, aggregateLeaderboard } from '@/lib/destiny/leaderboards'
import type { LeaderboardCategory, LeaderboardEntry, RunRecord, Season, SeasonWinner } from '@/lib/destiny/types'
import type { StoredDestinyUser } from '@/lib/destiny/destinyUserStore'

function prizeForRank(
  category: SeasonWinner['category'],
  rank: number,
  rules: Season['prizeRules']
): string {
  const bucket =
    category === 'raid' ? rules.raid : category === 'dungeon' ? rules.dungeon : rules.fullClanTeam

  if (rank === 1) return bucket.first
  if (rank === 2) return bucket.second
  if (rank === 3) return 'third' in bucket ? bucket.third : bucket.thirdToFifth
  if (rank <= 5 && 'thirdToFifth' in bucket) return bucket.thirdToFifth
  return 'participation' in bucket ? bucket.participation : 'Season participant'
}

/** Live season standings → hall of fame preview (Phase 5). */
export function computeSeasonStandings(
  runs: RunRecord[],
  usersById: Map<string, StoredDestinyUser>,
  season: Season
): {
  hallOfFame: SeasonWinner[]
  eligibility: string
} {
  const raidTop = aggregateLeaderboard(runs, usersById, 'raid', 'season').slice(0, 5)
  const dungeonTop = aggregateLeaderboard(runs, usersById, 'dungeon', 'season').slice(0, 5)
  const clanTop = aggregateClanLeaderboard(runs, usersById, 'season').slice(0, 3)

  const hallOfFame: SeasonWinner[] = [
    ...toWinners(raidTop, 'raid', season, 5),
    ...toWinners(dungeonTop, 'dungeon', season, 5),
    ...toWinners(clanTop, 'full_clan_team', season, 3),
  ]

  const storedWinners = season.winners ?? []
  const eligibility =
    raidTop.length || dungeonTop.length
      ? `Season ends ${new Date(season.endDate).toLocaleDateString()}. Current leaders are shown below — final prizes lock at season end.`
      : 'Sync verified raid and dungeon clears to appear on season leaderboards and prize tracks.'

  return {
    hallOfFame: storedWinners.length ? storedWinners : hallOfFame,
    eligibility,
  }
}

function toWinners(
  entries: LeaderboardEntry[],
  category: SeasonWinner['category'],
  season: Season,
  maxRank: number
): SeasonWinner[] {
  return entries.slice(0, maxRank).map((entry) => ({
    category,
    rank: entry.rank,
    displayName: entry.bungieDisplayName,
    clanTag: entry.clanTag,
    prize: prizeForRank(category, entry.rank, season.prizeRules),
    seasonId: season.id,
  }))
}

export function prizeEligibilityForUser(
  entries: LeaderboardEntry[],
  verifiedClears: number
): string {
  if (!verifiedClears) {
    return 'Sync verified runs from Home to start scoring and prize eligibility.'
  }

  const best = entries.sort((a, b) => a.rank - b.rank)[0]
  if (!best) {
    return 'Eligible for verified run scoring this season. Climb a leaderboard to track prize status.'
  }

  return `Season rank #${best.rank} in ${best.category.replace(/_/g, ' ')} — ${best.points} pts. Top 5 at season end win prizes.`
}

export interface UserPrizeTrackEntry {
  category: LeaderboardCategory
  rank: number
  points: number
  verifiedClears: number
  prizeIfHeld: string
  fastestActivityName?: string
  fastestClearSeconds?: number
}

/** Personal prize ladder for the signed-in player (Phase 5). */
export function buildUserPrizeTrack(
  entries: LeaderboardEntry[],
  season: Season
): UserPrizeTrackEntry[] {
  const byCategory = new Map<LeaderboardCategory, LeaderboardEntry>()
  for (const entry of entries) {
    const existing = byCategory.get(entry.category)
    if (!existing || entry.rank < existing.rank) {
      byCategory.set(entry.category, entry)
    }
  }

  return Array.from(byCategory.values())
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => ({
      category: entry.category,
      rank: entry.rank,
      points: entry.points,
      verifiedClears: entry.verifiedClears,
      prizeIfHeld: prizeForRank(entry.category, entry.rank, season.prizeRules),
      fastestActivityName: entry.fastestActivityName,
      fastestClearSeconds: entry.fastestClearSeconds,
    }))
}
