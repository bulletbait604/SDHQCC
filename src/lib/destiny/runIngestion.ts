import { getActivityHistory, getPlayerProfile, getPostGameCarnageReport } from '@/lib/destiny/bungieClient'
import {
  evaluateRunLegitimacy,
  verificationStatusFromReview,
} from '@/lib/destiny/legitimacyChecker'
import { resolveActivityByHash } from '@/lib/destiny/manifest'
import {
  extractBuildFromPgcr,
  parsePgcrDurationSeconds,
  type PgcrPayload,
} from '@/lib/destiny/pgcrBuildExtractor'
import { calculateRunPoints } from '@/lib/destiny/scoring'
import { ensureDestinyIndexes, queueAdminReview, saveBuildSnapshot, saveRunRecord } from '@/lib/destiny/store'
import type { StoredDestinyUser } from '@/lib/destiny/destinyUserStore'
import { getValidAccessToken } from '@/lib/destiny/destinyUserStore'
import type {
  ActivityType,
  DestinyCharacterClass,
  DestinyPlatform,
  RunRecord,
  RunTeamMember,
} from '@/lib/destiny/types'

const RAID_MODE = 4
const DUNGEON_MODE = 82
const SYNC_COUNT = 15

interface ActivityHistoryRow {
  activityDetails?: {
    instanceId?: string
    mode?: number
    referenceId?: number
    completionReason?: number
  }
  period?: string
}

interface PgcrEntry {
  player?: {
    destinyUserInfo?: {
      membershipId?: number | string
      displayName?: string
      membershipType?: number
    }
    characterClass?: string
  }
  values?: {
    kills?: number
    deaths?: number
    assists?: number
    score?: number
    completed?: number
  }
}

interface PgcrResponse extends PgcrPayload {
  activityDetails?: {
    instanceId?: string
    mode?: number
    referenceId?: number
    directorActivityHash?: number
    completionReason?: number
  }
  period?: string
  activityWasStartedFromBeginning?: boolean
  entries?: PgcrEntry[]
}

function parseTeamMembers(entries: PgcrEntry[] = []): RunTeamMember[] {
  return entries
    .filter((e) => e.player?.destinyUserInfo?.membershipId != null)
    .map((e) => {
      const info = e.player!.destinyUserInfo!
      const membershipType = Number(info.membershipType ?? 3)
      const classKey = e.player?.characterClass?.toLowerCase() ?? 'hunter'
      const characterClass: DestinyCharacterClass =
        classKey === 'titan' || classKey === 'warlock' || classKey === 'hunter'
          ? classKey
          : 'hunter'

      return {
        membershipId: String(info.membershipId),
        displayName: info.displayName ?? 'Guardian',
        platform:
          (membershipType === 1
            ? 'xbox'
            : membershipType === 2
              ? 'playstation'
              : membershipType === 6
                ? 'epic'
                : 'steam') as DestinyPlatform,
        characterClass,
        kills: e.values?.kills ?? 0,
        deaths: e.values?.deaths ?? 0,
        assists: e.values?.assists ?? 0,
        score: e.values?.score ?? 0,
        powerLevel: 0,
      }
    })
}

function analyzeClanMix(
  members: RunTeamMember[],
  userClanId?: string
): { clanMemberCount: number; randoCount: number; isFullClanTeam: boolean } {
  if (!userClanId) {
    return { clanMemberCount: 0, randoCount: Math.max(0, members.length - 1), isFullClanTeam: false }
  }
  const clanMemberCount = members.filter((m) => m.clanId === userClanId).length || 1
  const randoCount = Math.max(0, members.length - clanMemberCount)
  const isFullClanTeam = members.length >= 3 && randoCount === 0
  return { clanMemberCount, randoCount, isFullClanTeam }
}

async function fetchActivityList(
  membershipType: number,
  membershipId: string,
  characterId: string,
  mode: number
): Promise<ActivityHistoryRow[]> {
  const response = (await getActivityHistory(
    membershipType,
    membershipId,
    characterId,
    mode,
    SYNC_COUNT
  )) as { activities?: ActivityHistoryRow[] }

  return response?.activities ?? []
}

async function pgcrToRunRecord(
  instanceId: string,
  activityType: ActivityType,
  userId: string,
  displayName: string,
  userClanId?: string
): Promise<{ record: RunRecord; pgcr: PgcrResponse } | null> {
  const pgcr = (await getPostGameCarnageReport(instanceId)) as PgcrResponse
  const details = pgcr.activityDetails
  if (!details) return null

  const completed = (details.completionReason ?? 1) === 0
  const checkpointLikely = pgcr.activityWasStartedFromBeginning === false
  const durationSeconds = parsePgcrDurationSeconds(pgcr)
  const teamMembers = parseTeamMembers(pgcr.entries)
  const kills = teamMembers.map((m) => m.kills)
  const deaths = teamMembers.map((m) => m.deaths)
  const teamAvgKills = kills.length ? kills.reduce((a, b) => a + b, 0) / kills.length : 0
  const teamAvgDeaths = deaths.length ? deaths.reduce((a, b) => a + b, 0) / deaths.length : 0

  const aiReview = evaluateRunLegitimacy({
    activityType,
    durationSeconds,
    completed,
    checkpointLikely,
    playerCount: teamMembers.length,
    teamAvgDeaths,
    teamAvgKills,
  })

  const verificationStatus = verificationStatusFromReview(aiReview)
  const { clanMemberCount, randoCount, isFullClanTeam } = analyzeClanMix(teamMembers, userClanId)

  const scoring = calculateRunPoints({
    activityType,
    clanMemberCount,
    randoCount,
    isFullClanTeam,
    completed,
    checkpointLikely,
    verificationStatus,
    suspiciousScore: aiReview.suspiciousScore,
  })

  const activityHash = Number(details.referenceId ?? details.directorActivityHash ?? 0)
  let activityName =
    activityType === 'raid' ? `Raid ${activityHash || instanceId}` : `Dungeon ${activityHash || instanceId}`

  if (activityHash > 0) {
    try {
      const activityDef = await resolveActivityByHash(activityHash)
      activityName = activityDef.name
    } catch {
      /* keep fallback name */
    }
  }

  const record: RunRecord = {
    id: `run-${instanceId}`,
    pgcrId: instanceId,
    activityId: activityHash,
    activityName,
    type: activityType,
    difficulty: 'normal',
    completedAt: pgcr.period ? new Date(pgcr.period).toISOString() : new Date().toISOString(),
    durationSeconds,
    completed,
    checkpointLikely,
    teamMembers,
    clanMemberCount,
    randoCount,
    isFullClanTeam,
    suspiciousScore: aiReview.suspiciousScore,
    verificationStatus,
    aiReview,
    pointsAwarded: scoring.points,
    ownerUserId: userId,
    ownerDisplayName: displayName,
  }

  return { record, pgcr }
}

export async function syncRunsForUser(stored: StoredDestinyUser): Promise<{
  synced: number
  flagged: number
  skipped: number
  builds: number
}> {
  await ensureDestinyIndexes()

  const accessToken = await getValidAccessToken(stored)
  if (!accessToken) {
    throw new Error('Bungie session expired — reconnect your account from Overview.')
  }

  const membershipType = stored.destinyMembershipType
  const membershipId = stored.bungieMembershipId
  if (!membershipType || !membershipId) {
    throw new Error('Missing Destiny membership — disconnect and reconnect Bungie.')
  }

  const profile = (await getPlayerProfile(membershipType, membershipId, [100, 200])) as {
    characters?: { data?: Record<string, { classType?: number }> }
  }

  const characterIds = Object.keys(profile.characters?.data ?? {})
  if (!characterIds.length) {
    throw new Error('No characters found on linked Bungie account.')
  }

  const seen = new Set<string>()
  let synced = 0
  let flagged = 0
  let skipped = 0
  let builds = 0

  for (const characterId of characterIds) {
    for (const [mode, activityType] of [
      [RAID_MODE, 'raid'],
      [DUNGEON_MODE, 'dungeon'],
    ] as const) {
      let activities: ActivityHistoryRow[] = []
      try {
        activities = await fetchActivityList(membershipType, membershipId, characterId, mode)
      } catch (err) {
        console.warn('[runIngestion] activity history failed', { mode, characterId, err })
        continue
      }

      for (const row of activities) {
        const instanceId = row.activityDetails?.instanceId
        if (!instanceId || seen.has(instanceId)) continue
        seen.add(instanceId)

        try {
          const result = await pgcrToRunRecord(
            instanceId,
            activityType,
            stored.userId,
            stored.bungieDisplayName,
            stored.clanId
          )
          if (!result) {
            skipped++
            continue
          }

          const { record, pgcr } = result
          await saveRunRecord(record)

          const build = await extractBuildFromPgcr(pgcr, record, membershipId)
          if (build) {
            await saveBuildSnapshot(build)
            builds++
          }

          if (record.verificationStatus === 'flagged') {
            flagged++
            await queueAdminReview({
              id: `review-${record.id}`,
              runId: record.id,
              suspiciousScore: record.suspiciousScore,
              aiSummary: record.aiReview?.summary ?? 'Flagged for manual review',
              status: 'pending',
              run: record,
            })
          }

          synced++
        } catch (err) {
          console.warn('[runIngestion] PGCR failed', instanceId, err)
          skipped++
        }
      }
    }
  }

  return { synced, flagged, skipped, builds }
}
