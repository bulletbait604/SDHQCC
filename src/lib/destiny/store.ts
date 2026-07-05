/**
 * MongoDB persistence helpers for DestinyTopNest.
 * All user-facing data comes from Mongo + Bungie API — no mock fallbacks.
 */

import clientPromise from '@/lib/mongodb'
import { DESTINY_COLLECTIONS } from '@/lib/destiny/collections'
import { buildOverviewPayload } from '@/lib/destiny/overviewBuilder'
import {
  aggregateClanLeaderboard,
  aggregateLeaderboard,
} from '@/lib/destiny/leaderboards'
import { ACTIVE_SEASON } from '@/lib/destiny/seasonConfig'
import type { StoredDestinyUser } from '@/lib/destiny/destinyUserStore'
import type {
  AdminReviewRecord,
  BuildIntelligenceCard,
  ExternalBuildSource,
  FireteamLobby,
  LeaderboardEntry,
  OverviewPayload,
  RunRecord,
  Season,
} from '@/lib/destiny/types'

async function db() {
  const client = await clientPromise
  return client.db('sdhq')
}

export async function ensureDestinyIndexes(): Promise<void> {
  const database = await db()
  await database.collection(DESTINY_COLLECTIONS.runRecords).createIndex({ pgcrId: 1 }, { unique: true })
  await database.collection(DESTINY_COLLECTIONS.runRecords).createIndex({ verificationStatus: 1, completedAt: -1 })
  await database.collection(DESTINY_COLLECTIONS.runRecords).createIndex({ ownerUserId: 1, completedAt: -1 })
  await database.collection(DESTINY_COLLECTIONS.leaderboardEntries).createIndex({ category: 1, seasonId: 1, period: 1, rank: 1 })
  await database.collection(DESTINY_COLLECTIONS.fireteamLobbies).createIndex({ status: 1, createdAt: -1 })
  await database.collection(DESTINY_COLLECTIONS.users).createIndex({ bungieMembershipId: 1 }, { unique: true, sparse: true })
}

async function loadAllRuns(): Promise<RunRecord[]> {
  const database = await db()
  return (await database
    .collection(DESTINY_COLLECTIONS.runRecords)
    .find({})
    .sort({ completedAt: -1 })
    .limit(500)
    .toArray()) as unknown as RunRecord[]
}

async function loadUsersMap(): Promise<Map<string, StoredDestinyUser>> {
  const database = await db()
  const rows = (await database.collection(DESTINY_COLLECTIONS.users).find({}).toArray()) as unknown as StoredDestinyUser[]
  return new Map(rows.map((u) => [u.userId, u]))
}

export async function getRunsForUser(userId: string, limit = 25): Promise<RunRecord[]> {
  try {
    await ensureDestinyIndexes()
    const database = await db()
    return (await database
      .collection(DESTINY_COLLECTIONS.runRecords)
      .find({ ownerUserId: userId })
      .sort({ completedAt: -1 })
      .limit(limit)
      .toArray()) as unknown as RunRecord[]
  } catch {
    return []
  }
}

export async function getOverviewData(): Promise<OverviewPayload> {
  try {
    await ensureDestinyIndexes()
    const [runs, usersById, lobbies, buildCards] = await Promise.all([
      loadAllRuns(),
      loadUsersMap(),
      getFireteamLobbies(),
      getBuildIntelligenceCards(),
    ])

    const recentRuns = runs.slice(0, 10)
    const raidTop10 = aggregateLeaderboard(runs, usersById, 'raid', 'season')
    const dungeonTop10 = aggregateLeaderboard(runs, usersById, 'dungeon', 'season')
    const clanTop5 = aggregateClanLeaderboard(runs, usersById, 'season')

    return buildOverviewPayload({
      raidTop10,
      dungeonTop10,
      clanTop5,
      recentRuns,
      lookingForGroup: lobbies,
      trendingBuilds: buildCards.slice(0, 3),
    })
  } catch {
    return buildOverviewPayload({
      raidTop10: [],
      dungeonTop10: [],
      clanTop5: [],
      recentRuns: [],
      lookingForGroup: [],
      trendingBuilds: [],
    })
  }
}

export async function getLeaderboardEntries(
  category: LeaderboardEntry['category'],
  period: LeaderboardEntry['period']
): Promise<LeaderboardEntry[]> {
  try {
    await ensureDestinyIndexes()
    const [runs, usersById] = await Promise.all([loadAllRuns(), loadUsersMap()])
    if (category === 'full_clan_team') {
      return aggregateClanLeaderboard(runs, usersById, period)
    }
    return aggregateLeaderboard(runs, usersById, category, period)
  } catch {
    return []
  }
}

export async function getFireteamLobbies(): Promise<FireteamLobby[]> {
  try {
    const database = await db()
    const rows = await database
      .collection(DESTINY_COLLECTIONS.fireteamLobbies)
      .find({ status: 'open' })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()
    return rows as unknown as FireteamLobby[]
  } catch {
    return []
  }
}

export async function getSeasonData(): Promise<Season> {
  try {
    const database = await db()
    const row = await database.collection(DESTINY_COLLECTIONS.seasons).findOne({ status: 'active' })
    if (row) return row as unknown as Season
  } catch {
    /* use config */
  }
  return ACTIVE_SEASON
}

export async function getAdminReviewQueue(): Promise<AdminReviewRecord[]> {
  try {
    const database = await db()
    const rows = await database
      .collection(DESTINY_COLLECTIONS.adminReviews)
      .find({ status: 'pending' })
      .sort({ suspiciousScore: -1 })
      .limit(50)
      .toArray()
    return rows as unknown as AdminReviewRecord[]
  } catch {
    return []
  }
}

export async function getBuildIntelligenceCards(): Promise<BuildIntelligenceCard[]> {
  try {
    const database = await db()
    const rows = await database
      .collection(DESTINY_COLLECTIONS.buildSnapshots)
      .find({})
      .sort({ updatedAt: -1 })
      .limit(20)
      .toArray()
    return rows as unknown as BuildIntelligenceCard[]
  } catch {
    return []
  }
}

export async function getExternalBuildSources(): Promise<ExternalBuildSource[]> {
  try {
    const database = await db()
    const rows = await database
      .collection(DESTINY_COLLECTIONS.externalBuildSources)
      .find({ approved: true })
      .sort({ lastChecked: -1 })
      .limit(20)
      .toArray()
    return rows as unknown as ExternalBuildSource[]
  } catch {
    return []
  }
}

export async function saveRunRecord(record: RunRecord): Promise<void> {
  const database = await db()
  await database.collection(DESTINY_COLLECTIONS.runRecords).updateOne(
    { id: record.id },
    { $set: { ...record, updatedAt: new Date().toISOString() } },
    { upsert: true }
  )
}

export async function queueAdminReview(record: AdminReviewRecord): Promise<void> {
  const database = await db()
  await database.collection(DESTINY_COLLECTIONS.adminReviews).updateOne(
    { id: record.id },
    { $set: { ...record, updatedAt: new Date().toISOString() } },
    { upsert: true }
  )
}

export async function resolveAdminReview(
  reviewId: string,
  decision: string,
  adminId: string,
  notes?: string
): Promise<boolean> {
  const database = await db()
  const now = new Date().toISOString()
  const review = (await database
    .collection(DESTINY_COLLECTIONS.adminReviews)
    .findOne({ id: reviewId })) as AdminReviewRecord | null

  if (!review) return false

  const status =
    decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'approved'

  await database.collection(DESTINY_COLLECTIONS.adminReviews).updateOne(
    { id: reviewId },
    {
      $set: {
        status,
        decision,
        notes,
        adminId,
        reviewedAt: now,
        updatedAt: now,
      },
    }
  )

  if (review.runId) {
    const verificationStatus =
      decision === 'approve'
        ? 'verified'
        : decision === 'reject'
          ? 'rejected'
          : 'verified'

    const pointsUpdate =
      decision === 'approve' && review.run
        ? review.run.pointsAwarded
        : decision === 'checkpoint_non_scoring'
          ? 0
          : undefined

    await database.collection(DESTINY_COLLECTIONS.runRecords).updateOne(
      { id: review.runId },
      {
        $set: {
          verificationStatus,
          ...(pointsUpdate !== undefined ? { pointsAwarded: pointsUpdate } : {}),
          adminNotes: notes,
          updatedAt: now,
        },
      }
    )
  }

  return true
}
