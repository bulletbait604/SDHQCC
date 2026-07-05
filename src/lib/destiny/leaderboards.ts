import type {
  LeaderboardCategory,
  LeaderboardEntry,
  LeaderboardPeriod,
  RunRecord,
} from '@/lib/destiny/types'
import { ACTIVE_SEASON } from '@/lib/destiny/seasonConfig'
import { getWeeklyResetState } from '@/lib/destiny/weeklyRotation'
import type { StoredDestinyUser } from '@/lib/destiny/destinyUserStore'

interface UserAgg {
  userId: string
  points: number
  verifiedClears: number
  fastestClearSeconds?: number
  fastestActivityName?: string
}

function periodStart(period: LeaderboardPeriod): Date | null {
  const now = Date.now()
  switch (period) {
    case 'weekly': {
      const reset = getWeeklyResetState()
      return new Date(reset.resetAt)
    }
    case 'monthly':
      return new Date(now - 30 * 24 * 60 * 60 * 1000)
    case 'season':
      return new Date(ACTIVE_SEASON.startDate)
    case 'all_time':
      return null
  }
}

function runMatchesPeriod(run: RunRecord, period: LeaderboardPeriod): boolean {
  const start = periodStart(period)
  if (!start) return true
  if (period === 'season') {
    const end = new Date(ACTIVE_SEASON.endDate).getTime()
    const t = new Date(run.completedAt).getTime()
    return t >= start.getTime() && t <= end
  }
  return new Date(run.completedAt).getTime() >= start.getTime()
}

function runMatchesCategory(run: RunRecord, category: LeaderboardCategory): boolean {
  if (run.verificationStatus !== 'verified') return false
  if (category === 'raid') return run.type === 'raid'
  if (category === 'dungeon') return run.type === 'dungeon'
  return run.isFullClanTeam === true
}

export function aggregateLeaderboard(
  runs: RunRecord[],
  usersById: Map<string, StoredDestinyUser>,
  category: LeaderboardCategory,
  period: LeaderboardPeriod
): LeaderboardEntry[] {
  const agg = new Map<string, UserAgg>()

  for (const run of runs) {
    if (!run.ownerUserId) continue
    if (!runMatchesPeriod(run, period)) continue
    if (!runMatchesCategory(run, category)) continue

    const pts = run.pointsAwarded ?? 0
    if (pts <= 0 && category !== 'full_clan_team') continue

    const existing = agg.get(run.ownerUserId) ?? {
      userId: run.ownerUserId,
      points: 0,
      verifiedClears: 0,
    }

    existing.points += pts
    existing.verifiedClears += 1

    if (
      run.durationSeconds > 0 &&
      (existing.fastestClearSeconds == null || run.durationSeconds < existing.fastestClearSeconds)
    ) {
      existing.fastestClearSeconds = run.durationSeconds
      existing.fastestActivityName = run.activityName
    }

    agg.set(run.ownerUserId, existing)
  }

  const sorted = Array.from(agg.values()).sort((a, b) => b.points - a.points || b.verifiedClears - a.verifiedClears)

  return sorted.slice(0, 10).map((row, index) => {
    const user = usersById.get(row.userId)
    return {
      userId: row.userId,
      bungieDisplayName: user?.bungieDisplayName ?? runDisplayName(runs, row.userId),
      emblemUrl: user?.emblemUrl,
      clanTag: user?.clanTag,
      platform: user?.platform ?? 'steam',
      guardianRank: user?.guardianRank,
      powerLevel: user?.powerLevel,
      category,
      seasonId: ACTIVE_SEASON.id,
      period,
      points: row.points,
      verifiedClears: row.verifiedClears,
      rank: index + 1,
      fastestClearSeconds: row.fastestClearSeconds,
      fastestActivityName: row.fastestActivityName,
    }
  })
}

function runDisplayName(runs: RunRecord[], userId: string): string {
  const run = runs.find((r) => r.ownerUserId === userId)
  return run?.ownerDisplayName ?? userId
}

export function aggregateClanLeaderboard(
  runs: RunRecord[],
  usersById: Map<string, StoredDestinyUser>,
  period: LeaderboardPeriod
): LeaderboardEntry[] {
  const byClan = new Map<string, UserAgg & { clanTag?: string; clanName?: string }>()

  for (const run of runs) {
    if (!run.ownerUserId || !run.isFullClanTeam) continue
    if (!runMatchesPeriod(run, period)) continue
    if (run.verificationStatus !== 'verified') continue

    const user = usersById.get(run.ownerUserId)
    const clanKey = user?.clanId ?? user?.clanTag ?? 'unknown'
    const existing = byClan.get(clanKey) ?? {
      userId: clanKey,
      points: 0,
      verifiedClears: 0,
      clanTag: user?.clanTag,
      clanName: user?.clanName,
    }

    existing.points += run.pointsAwarded ?? 0
    existing.verifiedClears += 1
    byClan.set(clanKey, existing)
  }

  return Array.from(byClan.values())
    .sort((a, b) => b.points - a.points)
    .slice(0, 5)
    .map((row, index) => ({
      userId: row.userId,
      bungieDisplayName: row.clanName ?? row.clanTag ?? 'Clan',
      clanTag: row.clanTag,
      platform: 'steam' as const,
      category: 'full_clan_team' as const,
      seasonId: ACTIVE_SEASON.id,
      period,
      points: row.points,
      verifiedClears: row.verifiedClears,
      rank: index + 1,
    }))
}
