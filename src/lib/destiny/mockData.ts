import type {
  AdminReviewRecord,
  BuildIntelligenceCard,
  BuildSnapshot,
  ClanProfile,
  ExternalBuildSource,
  FireteamLobby,
  LeaderboardEntry,
  OverviewPayload,
  PlayerProfile,
  RunRecord,
  Season,
} from '@/lib/destiny/types'

const SEASON_ID = 's26-reclamation'

const EMBLEMS = [
  'https://www.bungie.net/common/destiny2_content/icons/emblem/emblem_default.png',
  'https://www.bungie.net/common/destiny2_content/icons/emblem/emblem_01.png',
]

function lbEntry(
  rank: number,
  name: string,
  category: LeaderboardEntry['category'],
  points: number,
  overrides: Partial<LeaderboardEntry> = {}
): LeaderboardEntry {
  return {
    userId: `user-${rank}`,
    bungieDisplayName: name,
    emblemUrl: EMBLEMS[rank % EMBLEMS.length],
    clanTag: overrides.clanTag ?? '[SDHQ]',
    platform: overrides.platform ?? 'steam',
    guardianRank: overrides.guardianRank ?? 12 - Math.floor(rank / 2),
    powerLevel: overrides.powerLevel ?? 2010 - rank,
    category,
    seasonId: SEASON_ID,
    period: 'season',
    points,
    verifiedClears: overrides.verifiedClears ?? 8 - Math.floor(rank / 3),
    rank,
    fastestClearSeconds: overrides.fastestClearSeconds ?? 3600 + rank * 120,
    fastestActivityName: overrides.fastestActivityName ?? 'Salvation\'s Edge',
    ...overrides,
  }
}

export const MOCK_SEASON: Season = {
  id: SEASON_ID,
  name: 'Reclamation',
  startDate: '2026-03-10T17:00:00Z',
  endDate: '2026-06-17T17:00:00Z',
  status: 'active',
  prizeRules: {
    raid: {
      first: '$50 CAD platform card (Xbox / PlayStation / Steam)',
      second: '$25 CAD platform card',
      thirdToFifth: '3D print prize',
      participation: 'Leaderboard history mention',
    },
    dungeon: {
      first: '$50 CAD platform card',
      second: '$25 CAD platform card',
      thirdToFifth: '3D print prize',
      participation: 'Leaderboard history mention',
    },
    fullClanTeam: {
      first: '$50 CAD platform card or clan prize',
      second: '$25 CAD platform card',
      third: '3D print prize',
    },
  },
  winners: [
    {
      category: 'raid',
      rank: 1,
      displayName: 'VoidWalkerPrime',
      clanTag: '[NEST]',
      prize: '$50 CAD Steam card',
      seasonId: 's25-ascendant',
    },
  ],
}

export const MOCK_RAID_TOP10: LeaderboardEntry[] = [
  lbEntry(1, 'VoidWalkerPrime', 'raid', 248, { fastestClearSeconds: 2847, fastestActivityName: 'Salvation\'s Edge' }),
  lbEntry(2, 'SolarSlinger99', 'raid', 231, { platform: 'xbox', clanTag: '[FLAME]' }),
  lbEntry(3, 'ArcMissileMike', 'raid', 219, { platform: 'playstation' }),
  lbEntry(4, 'PrismaticPanda', 'raid', 205),
  lbEntry(5, 'WellOfRadiance', 'raid', 198),
  lbEntry(6, 'TetherTrickster', 'raid', 187),
  lbEntry(7, 'BannerLord', 'raid', 176, { platform: 'xbox' }),
  lbEntry(8, 'StarfireWarlock', 'raid', 164),
  lbEntry(9, 'SynthoSlayer', 'raid', 152),
  lbEntry(10, 'DivinityDriver', 'raid', 141, { platform: 'playstation' }),
]

export const MOCK_DUNGEON_TOP10: LeaderboardEntry[] = [
  lbEntry(1, 'DeepDiver_D', 'dungeon', 186, { fastestActivityName: 'Ghosts of the Deep', fastestClearSeconds: 1124 }),
  lbEntry(2, 'SpireRunner', 'dungeon', 172),
  lbEntry(3, 'VesperVault', 'dungeon', 165, { platform: 'xbox' }),
  lbEntry(4, 'WarlordWave', 'dungeon', 158),
  lbEntry(5, 'OryxOrbit', 'dungeon', 149),
  lbEntry(6, 'CathedralCrawl', 'dungeon', 138),
  lbEntry(7, 'GraspGuardian', 'dungeon', 131),
  lbEntry(8, 'ProphecyPilot', 'dungeon', 124),
  lbEntry(9, 'DualityDash', 'dungeon', 118),
  lbEntry(10, 'SpireSprint', 'dungeon', 110),
]

export const MOCK_CLAN_TOP5: LeaderboardEntry[] = [
  lbEntry(1, 'NestFireteam Alpha', 'full_clan_team', 320, { clanTag: '[NEST]', verifiedClears: 14 }),
  lbEntry(2, 'StreamDreams Six', 'full_clan_team', 298, { clanTag: '[SDHQ]' }),
  lbEntry(3, 'Void Collective', 'full_clan_team', 276, { clanTag: '[VOID]' }),
  lbEntry(4, 'Solar Syndicate', 'full_clan_team', 254, { clanTag: '[SOLR]' }),
  lbEntry(5, 'Arc Assembly', 'full_clan_team', 231, { clanTag: '[ARC]' }),
]

export const MOCK_RECENT_RUNS: RunRecord[] = [
  {
    id: 'run-1',
    pgcrId: '1234567890123456789',
    activityId: 1234567890,
    activityName: 'Salvation\'s Edge',
    type: 'raid',
    difficulty: 'master',
    completedAt: new Date(Date.now() - 3600000).toISOString(),
    durationSeconds: 3842,
    completed: true,
    checkpointLikely: false,
    clanMemberCount: 4,
    randoCount: 2,
    isFullClanTeam: false,
    suspiciousScore: 12,
    verificationStatus: 'verified',
    pointsAwarded: 18,
    teamMembers: [
      { membershipId: '1', displayName: 'VoidWalkerPrime', platform: 'steam', characterClass: 'warlock', kills: 842, deaths: 4, assists: 120, score: 45000, powerLevel: 2010 },
      { membershipId: '2', displayName: 'BannerLord', platform: 'xbox', characterClass: 'titan', kills: 920, deaths: 6, assists: 98, score: 48000, powerLevel: 2008 },
    ],
    aiReview: {
      legitimacyStatus: 'clean',
      suspiciousScore: 12,
      reasons: ['Duration within expected range for Master Salvation\'s Edge'],
      recommendation: 'approve',
    },
  },
  {
    id: 'run-2',
    pgcrId: '9876543210987654321',
    activityId: 9876543210,
    activityName: 'Ghosts of the Deep',
    type: 'dungeon',
    difficulty: 'normal',
    completedAt: new Date(Date.now() - 7200000).toISOString(),
    durationSeconds: 1180,
    completed: true,
    checkpointLikely: false,
    clanMemberCount: 2,
    randoCount: 1,
    isFullClanTeam: false,
    suspiciousScore: 8,
    verificationStatus: 'verified',
    pointsAwarded: 9,
    teamMembers: [
      { membershipId: '3', displayName: 'DeepDiver_D', platform: 'steam', characterClass: 'hunter', kills: 412, deaths: 2, assists: 45, score: 22000, powerLevel: 2005 },
    ],
  },
  {
    id: 'run-3',
    pgcrId: '5555555555555555555',
    activityId: 5555555555,
    activityName: 'Vesper\'s Host',
    type: 'dungeon',
    difficulty: 'master',
    completedAt: new Date(Date.now() - 86400000).toISOString(),
    durationSeconds: 890,
    completed: true,
    checkpointLikely: true,
    clanMemberCount: 3,
    randoCount: 0,
    isFullClanTeam: true,
    suspiciousScore: 55,
    verificationStatus: 'flagged',
    pointsAwarded: 0,
    teamMembers: [],
    aiReview: {
      legitimacyStatus: 'suspicious',
      suspiciousScore: 55,
      reasons: ['Completion time unusually fast vs historical average', 'Possible checkpoint start detected'],
      recommendation: 'manual_review',
    },
  },
]

export const MOCK_LFG: FireteamLobby[] = [
  {
    id: 'lfg-1',
    hostUserId: 'user-1',
    hostDisplayName: 'VoidWalkerPrime',
    hostEmblemUrl: EMBLEMS[0],
    hostClass: 'warlock',
    hostPowerLevel: 2010,
    hostGuardianRank: 12,
    activityType: 'raid',
    activityName: 'Salvation\'s Edge',
    goal: 'fresh_run',
    tags: ['KWTD', 'Mic Required', 'Meta Loadouts', 'Boss DPS'],
    platform: 'crossplay',
    micRequired: true,
    scoringEligible: true,
    maxPlayers: 6,
    currentPlayers: 4,
    status: 'open',
    preferredRole: 'Well Warlock',
    createdAt: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: 'lfg-2',
    hostUserId: 'user-3',
    hostDisplayName: 'DeepDiver_D',
    hostClass: 'hunter',
    hostPowerLevel: 2005,
    activityType: 'dungeon',
    activityName: 'Ghosts of the Deep',
    goal: 'chill_clear',
    tags: ['New Players Welcome', 'No Mic', 'Crossplay OK', 'Chill'],
    platform: 'steam',
    micRequired: false,
    scoringEligible: true,
    maxPlayers: 3,
    currentPlayers: 2,
    status: 'open',
    createdAt: new Date(Date.now() - 1200000).toISOString(),
  },
  {
    id: 'lfg-3',
    hostUserId: 'user-5',
    hostDisplayName: 'WellOfRadiance',
    hostClass: 'warlock',
    hostPowerLevel: 2008,
    activityType: 'master_raid',
    activityName: 'Salvation\'s Edge',
    goal: 'competitive_scoring',
    tags: ['Serious', 'Fast Run', 'Mechanics Confident', 'Scoring Run'],
    platform: 'xbox',
    micRequired: true,
    scoringEligible: true,
    maxPlayers: 6,
    currentPlayers: 5,
    status: 'open',
    preferredRole: 'Support',
    createdAt: new Date(Date.now() - 300000).toISOString(),
  },
]

export const MOCK_BUILD: BuildSnapshot = {
  id: 'build-1',
  runId: 'run-1',
  userId: 'user-1',
  characterClass: 'warlock',
  subclass: 'Prismatic',
  super: 'Nova Bomb',
  aspects: ['Bleak Watcher', 'Icefall Mantle'],
  fragments: ['Echo of Undermining', 'Echo of Instability'],
  abilities: ['Healing Rift', 'Void Grenade'],
  exoticArmor: 'Rime-Coat Raiment',
  exoticWeapon: 'Wish-Keeper',
  kineticWeapon: 'Supremacy',
  energyWeapon: 'Calus\'s Selected',
  powerWeapon: 'Cataclysmic',
  armorMods: ['Harmonic Siphon', 'Ashes to Assets', 'Solar Resistance'],
  artifactPerks: ['Anti-Barrier Pulse', 'Overload Scout'],
  stats: { mobility: 45, resilience: 90, recovery: 100, discipline: 85, intellect: 70, strength: 55 },
  activityId: 1234567890,
  activityName: 'Salvation\'s Edge',
  difficulty: 'master',
  completedAt: new Date().toISOString(),
  durationSeconds: 3842,
  deaths: 4,
  fireteamComposition: '4 clan + 2 randos',
}

export const MOCK_PROFILE: PlayerProfile = {
  userId: 'demo-user',
  bungieMembershipId: '4611686018427387904',
  bungieDisplayName: 'VoidWalkerPrime#4821',
  platform: 'steam',
  clanId: 'nest-clan',
  clanName: 'Top Nest',
  clanTag: '[NEST]',
  emblemUrl: EMBLEMS[0],
  guardianRank: 12,
  powerLevel: 2010,
  characterClass: 'warlock',
  connectedAt: '2026-04-01T12:00:00Z',
  raidPoints: 248,
  dungeonPoints: 86,
  fullClanPoints: 64,
  verifiedClears: 22,
  reputationScore: 4.7,
  badges: ['Verified Raider', 'Sherpa', 'Full Clan Clear', 'Speed Runner'],
  favoriteActivities: ['Salvation\'s Edge', 'Ghosts of the Deep', 'Vesper\'s Host'],
  favoriteTeammates: ['BannerLord', 'SolarSlinger99', 'DivinityDriver'],
  recentRuns: MOCK_RECENT_RUNS.slice(0, 2),
  topCompletions: [
    { activityName: 'Salvation\'s Edge (Master)', durationSeconds: 2847, completedAt: '2026-05-20T22:00:00Z' },
    { activityName: 'Ghosts of the Deep', durationSeconds: 1124, completedAt: '2026-05-18T19:30:00Z' },
    { activityName: 'Vesper\'s Host (Master)', durationSeconds: 1456, completedAt: '2026-05-15T21:00:00Z' },
  ],
  prizeEligibility: 'Eligible for Raid Top 10 prizes this season (currently rank #1)',
  currentLoadout: MOCK_BUILD,
}

export const MOCK_BUILD_CARDS: BuildIntelligenceCard[] = [
  {
    id: 'bi-1',
    buildName: 'Prismatic Well Support',
    activityName: 'Salvation\'s Edge',
    characterClass: 'warlock',
    subclass: 'Prismatic',
    exoticArmor: 'Rime-Coat Raiment',
    exoticWeapon: 'Wish-Keeper',
    weapons: ['Supremacy', 'Calus\'s Selected', 'Cataclysmic'],
    keyStats: { recovery: 100, resilience: 90 },
    averageClearSeconds: 3120,
    usageRatePercent: 40,
    successRatePercent: 92,
    deathRatePercent: 1.2,
    topTeamName: 'NestFireteam Alpha',
    fireteamType: 'clan',
    role: 'support',
  },
  {
    id: 'bi-2',
    buildName: 'Banner DPS Titan',
    activityName: 'Salvation\'s Edge',
    characterClass: 'titan',
    subclass: 'Arc',
    exoticArmor: 'Cuirass of the Falling Star',
    weapons: ['Imminence', 'Null Composure', 'Stormchaser'],
    keyStats: { strength: 100, resilience: 85 },
    averageClearSeconds: 3280,
    usageRatePercent: 28,
    successRatePercent: 88,
    deathRatePercent: 2.1,
    topTeamName: 'StreamDreams Six',
    fireteamType: 'mixed',
    role: 'dps',
  },
  {
    id: 'bi-3',
    buildName: 'Starfire Fusion Hunter',
    activityName: 'Ghosts of the Deep',
    characterClass: 'hunter',
    subclass: 'Solar',
    exoticArmor: 'Star-Eater Scales',
    weapons: ['Submission', 'Calus\'s Selected', 'Sword'],
    keyStats: { mobility: 80, discipline: 90 },
    averageClearSeconds: 1180,
    usageRatePercent: 35,
    successRatePercent: 94,
    deathRatePercent: 0.8,
    topTeamName: 'DeepDiver_D + fireteam',
    fireteamType: 'solo_friendly',
    role: 'dps',
  },
]

export const MOCK_EXTERNAL_BUILDS: ExternalBuildSource[] = [
  {
    id: 'ext-1',
    title: 'Master SE Support Warlock',
    source: 'Destiny Top Nest Curated',
    sourceUrl: 'https://www.bungie.net',
    class: 'warlock',
    subclass: 'Prismatic',
    lastChecked: '2026-06-17T12:00:00Z',
    approved: true,
  },
]

export const MOCK_CLAN: ClanProfile = {
  id: 'nest-clan',
  name: 'Top Nest',
  tag: '[NEST]',
  memberCount: 48,
  points: 320,
  fullClanClears: 14,
  recruitmentOpen: true,
  avgRaidClearSeconds: 3420,
  avgDungeonClearSeconds: 1240,
  topMembers: [
    { displayName: 'VoidWalkerPrime', points: 248, emblemUrl: EMBLEMS[0] },
    { displayName: 'SolarSlinger99', points: 231 },
    { displayName: 'BannerLord', points: 176 },
  ],
  achievements: ['Full Clan Master Clear', 'Season Raid #1', 'Sherpa Squad'],
}

export const MOCK_ADMIN_QUEUE: AdminReviewRecord[] = MOCK_RECENT_RUNS.filter(
  (r) => r.verificationStatus === 'flagged' || r.suspiciousScore >= 40
).map((run) => ({
  id: `review-${run.id}`,
  runId: run.id,
  suspiciousScore: run.suspiciousScore,
  aiSummary: run.aiReview?.reasons.join('. ') ?? 'Pending AI review',
  status: 'pending' as const,
  run,
}))

export function getSeasonCountdown(): { days: number; hours: number; label: string } {
  const end = new Date(MOCK_SEASON.endDate).getTime()
  const now = Date.now()
  const diff = Math.max(0, end - now)
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  return { days, hours, label: `${days}d ${hours}h until season end` }
}

export function buildOverviewPayload(bungieApiConfigured: boolean): OverviewPayload {
  return {
    raidTop10: MOCK_RAID_TOP10,
    dungeonTop10: MOCK_DUNGEON_TOP10,
    clanTop5: MOCK_CLAN_TOP5,
    recentRuns: MOCK_RECENT_RUNS,
    featuredRaid: { name: 'Salvation\'s Edge', difficulty: 'master', resetsIn: '2d 14h' },
    featuredDungeon: { name: 'Ghosts of the Deep', difficulty: 'normal', resetsIn: '4d 6h' },
    season: MOCK_SEASON,
    seasonCountdown: getSeasonCountdown(),
    prizeSummary: 'Raid & Dungeon Top 5 win platform cards or 3D prints. Full Clan Team prizes for same-clan clears.',
    lookingForGroup: MOCK_LFG,
    trendingBuilds: MOCK_BUILD_CARDS,
    bungieApiConfigured,
  }
}

export function filterLeaderboard(
  entries: LeaderboardEntry[],
  category: LeaderboardEntry['category'],
  period: LeaderboardEntry['period']
): LeaderboardEntry[] {
  return entries
    .filter((e) => e.category === category && e.period === period)
    .sort((a, b) => a.rank - b.rank)
}
