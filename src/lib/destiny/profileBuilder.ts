import type { RunRecord, PlayerProfile } from '@/lib/destiny/types'
import type { StoredDestinyUser } from '@/lib/destiny/destinyUserStore'

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
    prizeEligibility: 'Connect Bungie on Overview to sync your Guardian and verified runs.',
  }
}

export function buildPlayerProfileFromStored(
  stored: StoredDestinyUser,
  runs: RunRecord[],
  loadout?: PlayerProfile['currentLoadout']
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

  const badges: string[] = []
  if (verified.length >= 1) badges.push('Verified raider')
  if (verified.length >= 10) badges.push('10+ verified clears')
  if (fullClanPoints > 0) badges.push('Clan team scorer')

  return {
    userId: stored.userId,
    bungieMembershipId: stored.bungieMembershipId,
    bungieDisplayName: stored.bungieDisplayName,
    platform: stored.platform,
    clanId: stored.clanId,
    clanName: stored.clanName,
    clanTag: stored.clanTag,
    emblemUrl: stored.emblemUrl,
    guardianRank: stored.guardianRank,
    powerLevel: stored.powerLevel,
    characterClass: stored.characterClass,
    connectedAt: stored.connectedAt,
    raidPoints,
    dungeonPoints,
    fullClanPoints,
    verifiedClears: verified.length,
    reputationScore: Math.min(5, 3 + verified.length * 0.05),
    badges,
    favoriteActivities: Array.from(new Set(verified.map((r) => r.activityName))).slice(0, 5),
    favoriteTeammates,
    recentRuns: userRuns.slice(0, 10),
    topCompletions,
    prizeEligibility:
      verified.length > 0
        ? 'Eligible for verified run scoring this season.'
        : 'Sync verified runs from Overview to start scoring.',
    currentLoadout: loadout,
  }
}
