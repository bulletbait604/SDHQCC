import type { LeaderboardEntry, PlayerProfile, ReputationReview, RunRecord, TrustReview } from '@/lib/destiny/types'
import type { StoredDestinyUser } from '@/lib/destiny/destinyUserStore'
import {
  buildProfileFlexStats,
  DEFAULT_PROFILE_FLEX_STATS,
  sanitizeFlexPreferences,
} from '@/lib/destiny/profileFlex'
import { prizeEligibilityForUser } from '@/lib/destiny/seasonPrizes'
import { computeReputationScore, reputationBadges } from '@/lib/destiny/reputation'
import { computeTrustRank } from '@/lib/destiny/trustRank'

export function emptyPlayerProfile(userId: string): PlayerProfile {
  return {
    userId,
    bungieMembershipId: '',
    bungieDisplayName: 'Not linked',
    platform: 'steam',
    raidPoints: 0,
    dungeonPoints: 0,
    fullClanPoints: 0,
    verifiedClears: 0,
    reputationScore: 0,
    badges: [],
    favoriteActivities: [],
    favoriteTeammates: [],
    recentRuns: [],
    topCompletions: [],
    prizeEligibility: 'Connect Bungie on Home to sync your Guardian and verified runs.',
  }
}

export function buildPlayerProfileFromStored(
  stored: StoredDestinyUser,
  runs: RunRecord[],
  options?: {
    loadout?: PlayerProfile['currentLoadout']
    reviews?: ReputationReview[]
    trustReviews?: TrustReview[]
    seasonLeaderboardEntries?: LeaderboardEntry[]
  }
): PlayerProfile {
  const userRuns = runs.filter((r) => r.ownerUserId === stored.userId)
  const verified = userRuns.filter((r) => r.verificationStatus === 'verified')

  const raidPoints = verified.filter((r) => r.type === 'raid').reduce((s, r) => s + (r.pointsAwarded ?? 0), 0)
  const dungeonPoints = verified
    .filter((r) => r.type === 'dungeon')
    .reduce((s, r) => s + (r.pointsAwarded ?? 0), 0)
  const fullClanPoints = verified
    .filter((r) => r.isFullClanTeam)
    .reduce((s, r) => s + (r.pointsAwarded ?? 0), 0)

  const topCompletions = [...verified]
    .filter((r) => r.durationSeconds > 0)
    .sort((a, b) => a.durationSeconds - b.durationSeconds)
    .slice(0, 5)
    .map((r) => ({
      activityName: r.activityName,
      durationSeconds: r.durationSeconds,
      completedAt: r.completedAt,
    }))

  const teammateCounts = new Map<string, number>()
  for (const run of verified) {
    for (const member of run.teamMembers) {
      if (member.displayName === stored.bungieDisplayName) continue
      teammateCounts.set(member.displayName, (teammateCounts.get(member.displayName) ?? 0) + 1)
    }
  }
  const favoriteTeammates = Array.from(teammateCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name)

  const reviews = options?.reviews ?? []
  const reputationScore = computeReputationScore(reviews)
  const badges = reputationBadges(reviews, verified.length)
  if (fullClanPoints > 0 && !badges.includes('Clan team scorer')) {
    badges.push('Clan team scorer')
  }

  const seasonEntries = options?.seasonLeaderboardEntries ?? []
  const flexPreferences = sanitizeFlexPreferences(
    stored.profileFlexStats ?? DEFAULT_PROFILE_FLEX_STATS
  )

  const base: PlayerProfile = {
    userId: stored.userId,
    bungieMembershipId: stored.bungieMembershipId,
    bungieDisplayName: stored.bungieDisplayName,
    platform: stored.platform,
    clanId: stored.clanId,
    clanName: stored.clanName,
    clanTag: stored.clanTag,
    emblemUrl: stored.emblemUrl,
    emblemBackgroundUrl: stored.emblemBackgroundUrl,
    characterThumbnailUrl: stored.characterThumbnailUrl,
    emblemColor: stored.emblemColor,
    activeCharacterId: stored.activeCharacterId,
    profileFlexStats: flexPreferences,
    bungieStats: stored.bungieStats,
    guardianRank: stored.guardianRank,
    powerLevel: stored.powerLevel,
    characterClass: stored.characterClass,
    connectedAt: stored.connectedAt,
    raidPoints,
    dungeonPoints,
    fullClanPoints,
    verifiedClears: verified.length,
    reputationScore,
    badges,
    favoriteActivities: Array.from(new Set(verified.map((r) => r.activityName))).slice(0, 5),
    favoriteTeammates,
    recentRuns: userRuns.slice(0, 10),
    topCompletions,
    prizeEligibility: prizeEligibilityForUser(seasonEntries, verified.length),
    currentLoadout: options?.loadout,
  }

  return {
    ...base,
    flexStats: buildProfileFlexStats(base, flexPreferences, seasonEntries),
    trustRank: computeTrustRank(options?.trustReviews ?? []),
  }
}
