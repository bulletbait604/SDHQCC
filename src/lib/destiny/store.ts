/**
 * MongoDB persistence helpers for DestinyTopNest.
 * Phase 1: schema-ready CRUD; seed from mock when collections are empty.
 */

import clientPromise from '@/lib/mongodb'
import { DESTINY_COLLECTIONS } from '@/lib/destiny/collections'
import {
  MOCK_ADMIN_QUEUE,
  MOCK_BUILD,
  MOCK_BUILD_CARDS,
  MOCK_CLAN,
  MOCK_DUNGEON_TOP10,
  MOCK_EXTERNAL_BUILDS,
  MOCK_LFG,
  MOCK_PROFILE,
  MOCK_RAID_TOP10,
  MOCK_RECENT_RUNS,
  MOCK_SEASON,
  buildOverviewPayload,
} from '@/lib/destiny/mockData'
import { destinyApiConfigured } from '@/lib/destiny/env'
import type {
  AdminReviewRecord,
  FireteamLobby,
  LeaderboardEntry,
  OverviewPayload,
  PlayerProfile,
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
  await database.collection(DESTINY_COLLECTIONS.leaderboardEntries).createIndex({ category: 1, seasonId: 1, period: 1, rank: 1 })
  await database.collection(DESTINY_COLLECTIONS.fireteamLobbies).createIndex({ status: 1, createdAt: -1 })
  await database.collection(DESTINY_COLLECTIONS.users).createIndex({ bungieMembershipId: 1 }, { unique: true, sparse: true })
}

export async function getOverviewData(): Promise<OverviewPayload> {
  try {
    await ensureDestinyIndexes()
    const database = await db()
    const runCount = await database.collection(DESTINY_COLLECTIONS.runRecords).countDocuments()
    if (runCount === 0) {
      return buildOverviewPayload(destinyApiConfigured())
    }
    const recentRuns = (await database
      .collection(DESTINY_COLLECTIONS.runRecords)
      .find({})
      .sort({ completedAt: -1 })
      .limit(10)
      .toArray()) as unknown as RunRecord[]

    const payload = buildOverviewPayload(destinyApiConfigured())
    return { ...payload, recentRuns: recentRuns.length ? recentRuns : payload.recentRuns }
  } catch {
    return buildOverviewPayload(destinyApiConfigured())
  }
}

export async function getLeaderboardEntries(
  category: LeaderboardEntry['category'],
  period: LeaderboardEntry['period']
): Promise<LeaderboardEntry[]> {
  try {
    const database = await db()
    const rows = await database
      .collection(DESTINY_COLLECTIONS.leaderboardEntries)
      .find({ category, period })
      .sort({ rank: 1 })
      .limit(10)
      .toArray()
    if (rows.length) return rows as unknown as LeaderboardEntry[]
  } catch {
    /* fall through to mock */
  }

  if (category === 'raid') return MOCK_RAID_TOP10.map((e) => ({ ...e, period }))
  if (category === 'dungeon') return MOCK_DUNGEON_TOP10.map((e) => ({ ...e, period }))
  return MOCK_RAID_TOP10.slice(0, 5).map((e, i) => ({
    ...MOCK_RAID_TOP10[i] ?? e,
    category: 'full_clan_team' as const,
    period,
    rank: i + 1,
  }))
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
    if (rows.length) return rows as unknown as FireteamLobby[]
  } catch {
    /* mock */
  }
  return MOCK_LFG
}

export async function getPlayerProfile(userId?: string): Promise<PlayerProfile> {
  if (userId) {
    try {
      const database = await db()
      const row = await database.collection(DESTINY_COLLECTIONS.users).findOne({ userId })
      if (row) return row as unknown as PlayerProfile
    } catch {
      /* mock */
    }
  }
  return MOCK_PROFILE
}

export async function getSeasonData(): Promise<Season> {
  try {
    const database = await db()
    const row = await database.collection(DESTINY_COLLECTIONS.seasons).findOne({ status: 'active' })
    if (row) return row as unknown as Season
  } catch {
    /* mock */
  }
  return MOCK_SEASON
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
    if (rows.length) return rows as unknown as AdminReviewRecord[]
  } catch {
    /* mock */
  }
  return MOCK_ADMIN_QUEUE
}

export async function saveRunRecord(record: RunRecord): Promise<void> {
  const database = await db()
  await database.collection(DESTINY_COLLECTIONS.runRecords).updateOne(
    { id: record.id },
    { $set: { ...record, updatedAt: new Date().toISOString() } },
    { upsert: true }
  )
}

export { MOCK_BUILD, MOCK_BUILD_CARDS, MOCK_CLAN, MOCK_EXTERNAL_BUILDS, MOCK_RECENT_RUNS }
