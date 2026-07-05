/**
 * MongoDB persistence helpers for DestinyTopNest.
 * All user-facing data comes from Mongo + Bungie API — no mock fallbacks.
 */

import clientPromise from '@/lib/mongodb'
import { DESTINY_COLLECTIONS } from '@/lib/destiny/collections'
import { buildOverviewPayload } from '@/lib/destiny/overviewBuilder'
import { computeSeasonStandings } from '@/lib/destiny/seasonPrizes'
import { computeReputationScore } from '@/lib/destiny/reputation'
import { aggregateClanLeaderboard, aggregateLeaderboard } from '@/lib/destiny/leaderboards'
import {
  getResearchedMetaBuilds,
  META_BUILD_RESEARCH_DATE,
  META_RESEARCH_SOURCES,
} from '@/lib/destiny/externalMetaResearch'
import { aggregateBuildIntelligence, verifiedRunIdSet } from '@/lib/destiny/buildIntelligence'
import { rankTopLoadoutsByClass } from '@/lib/destiny/loadoutRankings'
import { ACTIVE_SEASON } from '@/lib/destiny/seasonConfig'
import type { StoredDestinyUser } from '@/lib/destiny/destinyUserStore'
import type {
  AdminReviewRecord,
  BuildIntelligenceCard,
  BuildSnapshot,
  ExternalBuildSource,
  FireteamLobby,
  LeaderboardEntry,
  OverviewPayload,
  PrizeClaim,
  ReputationReview,
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
  await database.collection(DESTINY_COLLECTIONS.runRecords).createIndex({ 'teamMembers.membershipId': 1, completedAt: -1 })
  await database.collection(DESTINY_COLLECTIONS.leaderboardEntries).createIndex({ category: 1, seasonId: 1, period: 1, rank: 1 })
  await database.collection(DESTINY_COLLECTIONS.fireteamLobbies).createIndex({ status: 1, createdAt: -1 })
  await database.collection(DESTINY_COLLECTIONS.buildSnapshots).createIndex({ runId: 1, userId: 1 }, { unique: true })
  await database.collection(DESTINY_COLLECTIONS.reputationReviews).createIndex({ reviewedUserId: 1, createdAt: -1 })
  await database.collection(DESTINY_COLLECTIONS.reputationReviews).createIndex({ reviewerId: 1, runId: 1 })
  await database.collection(DESTINY_COLLECTIONS.users).createIndex({ bungieMembershipId: 1 }, { unique: true, sparse: true })
  await database.collection(DESTINY_COLLECTIONS.seasons).createIndex({ status: 1 })
  await database.collection(DESTINY_COLLECTIONS.prizeClaims).createIndex({ userId: 1, seasonId: 1 })
  await database.collection(DESTINY_COLLECTIONS.prizeClaims).createIndex({ status: 1, createdAt: -1 })
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

export async function loadUsersMap(): Promise<Map<string, StoredDestinyUser>> {
  const database = await db()
  const rows = (await database.collection(DESTINY_COLLECTIONS.users).find({}).toArray()) as unknown as StoredDestinyUser[]
  return new Map(rows.map((u) => [u.userId, u]))
}

export async function getSeasonStandingsInput(): Promise<{
  runs: RunRecord[]
  usersById: Map<string, StoredDestinyUser>
}> {
  await ensureDestinyIndexes()
  const [runs, usersById] = await Promise.all([loadAllRuns(), loadUsersMap()])
  return { runs, usersById }
}

export async function getSeasonStandingForUser(userId: string): Promise<LeaderboardEntry[]> {
  try {
    const season = await getSeasonData()
    const [runs, usersById] = await Promise.all([loadAllRuns(), loadUsersMap()])
    return [
      ...aggregateLeaderboard(runs, usersById, 'raid', 'season', season),
      ...aggregateLeaderboard(runs, usersById, 'dungeon', 'season', season),
      ...aggregateLeaderboard(runs, usersById, 'full_clan_team', 'season', season),
    ].filter((entry) => entry.userId === userId)
  } catch {
    return []
  }
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

export async function getRunsForParticipant(
  userId: string,
  membershipId: string | undefined,
  limit = 25
): Promise<RunRecord[]> {
  try {
    await ensureDestinyIndexes()
    const database = await db()
    const or: Record<string, unknown>[] = [{ ownerUserId: userId }]
    if (membershipId) {
      or.push({ 'teamMembers.membershipId': membershipId })
    }
    return (await database
      .collection(DESTINY_COLLECTIONS.runRecords)
      .find({ $or: or })
      .sort({ completedAt: -1 })
      .limit(limit)
      .toArray()) as unknown as RunRecord[]
  } catch {
    return getRunsForUser(userId, limit)
  }
}

async function attachReputationScores(entries: LeaderboardEntry[]): Promise<LeaderboardEntry[]> {
  return Promise.all(
    entries.map(async (entry) => {
      const reviews = await getReputationReviewsForUser(entry.userId)
      const score = computeReputationScore(reviews)
      return {
        ...entry,
        reputationScore: score > 0 ? score : undefined,
        reputationReviewCount: reviews.length || undefined,
      }
    })
  )
}

export async function getOverviewData(): Promise<OverviewPayload> {
  try {
    await ensureDestinyIndexes()
    const season = await getSeasonData()
    const [runs, usersById, lobbies, buildCards] = await Promise.all([
      loadAllRuns(),
      loadUsersMap(),
      getFireteamLobbies(),
      getBuildIntelligenceCards(),
    ])

    const recentRuns = runs.slice(0, 10)
    const raidTop10 = await attachReputationScores(
      aggregateLeaderboard(runs, usersById, 'raid', 'season', season)
    )
    const dungeonTop10 = await attachReputationScores(
      aggregateLeaderboard(runs, usersById, 'dungeon', 'season', season)
    )
    const clanTop5 = aggregateClanLeaderboard(runs, usersById, 'season', season)
    const topLoadoutsByClass = rankTopLoadoutsByClass(buildCards, 2)
    const { hallOfFame } = computeSeasonStandings(runs, usersById, season)

    return buildOverviewPayload({
      raidTop10,
      dungeonTop10,
      clanTop5,
      recentRuns,
      lookingForGroup: lobbies,
      trendingBuilds: buildCards.slice(0, 3),
      topLoadoutsByClass,
      hallOfFamePreview: hallOfFame.slice(0, 9),
      season,
    })
  } catch {
    const emptyLoadouts = rankTopLoadoutsByClass([], 2)
    return buildOverviewPayload({
      raidTop10: [],
      dungeonTop10: [],
      clanTop5: [],
      recentRuns: [],
      lookingForGroup: [],
      trendingBuilds: [],
      topLoadoutsByClass: emptyLoadouts,
      hallOfFamePreview: [],
    })
  }
}

export async function getLeaderboardEntries(
  category: LeaderboardEntry['category'],
  period: LeaderboardEntry['period']
): Promise<LeaderboardEntry[]> {
  try {
    await ensureDestinyIndexes()
    const season = await getSeasonData()
    const [runs, usersById] = await Promise.all([loadAllRuns(), loadUsersMap()])
    const entries =
      category === 'full_clan_team'
        ? aggregateClanLeaderboard(runs, usersById, period, season)
        : aggregateLeaderboard(runs, usersById, category, period, season)
    return attachReputationScores(entries)
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
    await ensureDestinyIndexes()
    const database = await db()
    const active = await database.collection(DESTINY_COLLECTIONS.seasons).findOne({ status: 'active' })
    if (active) return active as unknown as Season

    const latest = await database
      .collection(DESTINY_COLLECTIONS.seasons)
      .findOne({}, { sort: { endDate: -1 } })
    if (latest) return latest as unknown as Season

    await database.collection(DESTINY_COLLECTIONS.seasons).updateOne(
      { id: ACTIVE_SEASON.id },
      { $set: { ...ACTIVE_SEASON, updatedAt: new Date().toISOString() } },
      { upsert: true }
    )
    return ACTIVE_SEASON
  } catch {
    return ACTIVE_SEASON
  }
}

export async function saveSeasonData(season: Season): Promise<void> {
  const database = await db()
  await database.collection(DESTINY_COLLECTIONS.seasons).updateOne(
    { id: season.id },
    { $set: { ...season, updatedAt: new Date().toISOString() } },
    { upsert: true }
  )
}

export async function finalizeActiveSeason(): Promise<Season> {
  const season = await getSeasonData()
  const { runs, usersById } = await getSeasonStandingsInput()
  const { hallOfFame } = computeSeasonStandings(runs, usersById, season)

  const archived: Season = {
    ...season,
    status: 'archived',
    winners: hallOfFame,
    endDate: new Date().toISOString(),
  }

  await saveSeasonData(archived)
  return archived
}

export async function getPrizeClaimsForUser(userId: string, seasonId: string): Promise<PrizeClaim[]> {
  try {
    const database = await db()
    const rows = await database
      .collection(DESTINY_COLLECTIONS.prizeClaims)
      .find({ userId, seasonId })
      .sort({ createdAt: -1 })
      .toArray()
    return rows as unknown as PrizeClaim[]
  } catch {
    return []
  }
}

export async function getPendingPrizeClaims(): Promise<PrizeClaim[]> {
  try {
    const database = await db()
    const rows = await database
      .collection(DESTINY_COLLECTIONS.prizeClaims)
      .find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()
    return rows as unknown as PrizeClaim[]
  } catch {
    return []
  }
}

export async function savePrizeClaim(claim: PrizeClaim): Promise<void> {
  const database = await db()
  await database.collection(DESTINY_COLLECTIONS.prizeClaims).updateOne(
    { id: claim.id },
    { $set: { ...claim, updatedAt: new Date().toISOString() } },
    { upsert: true }
  )
}

export async function updatePrizeClaimStatus(
  claimId: string,
  status: PrizeClaim['status'],
  adminNotes?: string
): Promise<boolean> {
  const database = await db()
  const result = await database.collection(DESTINY_COLLECTIONS.prizeClaims).updateOne(
    { id: claimId },
    { $set: { status, adminNotes, updatedAt: new Date().toISOString() } }
  )
  return result.matchedCount > 0
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
    await ensureDestinyIndexes()
    const database = await db()
    const [rows, runs] = await Promise.all([
      database
        .collection(DESTINY_COLLECTIONS.buildSnapshots)
        .find({})
        .sort({ completedAt: -1 })
        .limit(500)
        .toArray(),
      loadAllRuns(),
    ])
    const snapshots = rows as unknown as BuildSnapshot[]
    return aggregateBuildIntelligence(snapshots, verifiedRunIdSet(runs))
  } catch {
    return []
  }
}

export async function saveBuildSnapshot(snapshot: BuildSnapshot): Promise<void> {
  const database = await db()
  await database.collection(DESTINY_COLLECTIONS.buildSnapshots).updateOne(
    { runId: snapshot.runId, userId: snapshot.userId },
    { $set: { ...snapshot, updatedAt: new Date().toISOString() } },
    { upsert: true }
  )
}

export async function getReputationReviewsForUser(userId: string): Promise<ReputationReview[]> {
  try {
    const database = await db()
    const rows = await database
      .collection(DESTINY_COLLECTIONS.reputationReviews)
      .find({ reviewedUserId: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()
    return rows as unknown as ReputationReview[]
  } catch {
    return []
  }
}

export async function getReputationReviewsByReviewer(reviewerId: string): Promise<ReputationReview[]> {
  try {
    const database = await db()
    const rows = await database
      .collection(DESTINY_COLLECTIONS.reputationReviews)
      .find({ reviewerId })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()
    return rows as unknown as ReputationReview[]
  } catch {
    return []
  }
}

export async function findReputationReview(
  reviewerId: string,
  reviewedUserId: string,
  runId?: string
): Promise<ReputationReview | null> {
  try {
    const database = await db()
    const query: Record<string, string> = { reviewerId, reviewedUserId }
    if (runId) query.runId = runId
    const row = await database.collection(DESTINY_COLLECTIONS.reputationReviews).findOne(query)
    return row as ReputationReview | null
  } catch {
    return null
  }
}

export async function saveReputationReview(review: ReputationReview): Promise<void> {
  const database = await db()
  await database.collection(DESTINY_COLLECTIONS.reputationReviews).updateOne(
    { id: review.id },
    { $set: { ...review, updatedAt: new Date().toISOString() } },
    { upsert: true }
  )
}

export async function getExternalBuildSources(): Promise<ExternalBuildSource[]> {
  const researched = getResearchedMetaBuilds()
  try {
    await ensureDestinyIndexes()
    const database = await db()

    for (const build of researched) {
      await database.collection(DESTINY_COLLECTIONS.externalBuildSources).updateOne(
        { id: build.id },
        { $set: { ...build, updatedAt: new Date().toISOString() } },
        { upsert: true }
      )
    }

    const rows = await database
      .collection(DESTINY_COLLECTIONS.externalBuildSources)
      .find({ approved: true })
      .sort({ lastChecked: -1 })
      .limit(40)
      .toArray()

    const byId = new Map<string, ExternalBuildSource>()
    for (const build of researched) byId.set(build.id, build)
    for (const row of rows as unknown as ExternalBuildSource[]) {
      if (!byId.has(row.id)) byId.set(row.id, row)
    }

    return Array.from(byId.values()).sort(
      (a, b) => Date.parse(b.lastChecked) - Date.parse(a.lastChecked)
    )
  } catch {
    return researched
  }
}

export function getMetaResearchMeta() {
  return {
    researchedAt: META_BUILD_RESEARCH_DATE,
    sources: META_RESEARCH_SOURCES,
    windowWeeks: 4,
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

    await database.collection(DESTINY_COLLECTIONS.buildSnapshots).updateMany(
      { runId: review.runId },
      { $set: { verificationStatus, updatedAt: now } }
    )
  }

  return true
}
