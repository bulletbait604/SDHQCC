/** DestinyTopNest domain types — Mongo + API shapes. */

export type DestinyPlatform = 'steam' | 'xbox' | 'playstation' | 'epic' | 'stadia'
export type DestinyCharacterClass = 'titan' | 'hunter' | 'warlock'
export type ActivityType = 'raid' | 'dungeon'
export type VerificationStatus = 'verified' | 'pending' | 'flagged' | 'rejected'
export type LegitimacyStatus = 'clean' | 'warning' | 'suspicious' | 'highly_suspicious'
export type LeaderboardCategory = 'raid' | 'dungeon' | 'full_clan_team'
export type LeaderboardPeriod = 'weekly' | 'monthly' | 'season' | 'all_time'
export type Difficulty = 'normal' | 'master'
export type FireteamGoal =
  | 'fresh_run'
  | 'checkpoint_run'
  | 'teaching_run'
  | 'farming_run'
  | 'triumph_run'
  | 'catalyst_run'
  | 'chill_clear'
  | 'competitive_scoring'
export type FireteamStatus = 'open' | 'full' | 'in_progress' | 'closed'
export type DestinyTopNestTab =
  | 'overview'
  | 'leaderboards'
  | 'fireteam'
  | 'profile'
  | 'loadouts'
  | 'builds'
  | 'clans'
  | 'season'
  | 'admin'

export interface DestinyUser {
  userId: string
  bungieMembershipId: string
  bungieDisplayName: string
  platform: DestinyPlatform
  clanId?: string
  clanName?: string
  clanTag?: string
  emblemUrl?: string
  bannerUrl?: string
  guardianRank?: number
  powerLevel?: number
  characterClass?: DestinyCharacterClass
  connectedAt?: string
}

export interface RunTeamMember {
  membershipId: string
  displayName: string
  platform: DestinyPlatform
  characterClass: DestinyCharacterClass
  clanId?: string
  clanName?: string
  kills: number
  deaths: number
  assists: number
  score: number
  powerLevel: number
}

export interface AiReview {
  legitimacyStatus: LegitimacyStatus
  suspiciousScore: number
  reasons: string[]
  recommendation: 'approve' | 'manual_review' | 'reject'
  summary?: string
}

export interface RunRecord {
  id: string
  pgcrId: string
  activityId: number
  activityName: string
  type: ActivityType
  difficulty: Difficulty
  completedAt: string
  durationSeconds: number
  completed: boolean
  checkpointLikely: boolean
  teamMembers: RunTeamMember[]
  clanMemberCount: number
  randoCount: number
  isFullClanTeam: boolean
  suspiciousScore: number
  verificationStatus: VerificationStatus
  aiReview?: AiReview
  adminNotes?: string
  pointsAwarded: number
}

export interface LeaderboardEntry {
  userId: string
  bungieDisplayName: string
  emblemUrl?: string
  clanTag?: string
  platform: DestinyPlatform
  guardianRank?: number
  powerLevel?: number
  category: LeaderboardCategory
  seasonId: string
  period: LeaderboardPeriod
  points: number
  verifiedClears: number
  rank: number
  fastestClearSeconds?: number
  fastestActivityName?: string
}

export interface FireteamLobby {
  id: string
  hostUserId: string
  hostDisplayName: string
  hostEmblemUrl?: string
  hostClass?: DestinyCharacterClass
  hostPowerLevel?: number
  hostGuardianRank?: number
  activityType: ActivityType | 'master_raid' | 'master_dungeon' | 'weekly_featured'
  activityName: string
  goal: FireteamGoal
  tags: string[]
  platform: DestinyPlatform | 'crossplay'
  micRequired: boolean
  scoringEligible: boolean
  maxPlayers: number
  currentPlayers: number
  status: FireteamStatus
  preferredRole?: string
  createdAt: string
}

export interface ReputationReview {
  id: string
  reviewerId: string
  reviewedUserId: string
  runId?: string
  communication: number
  reliability: number
  mechanics: number
  friendly: number
  teaching: number
  punctual: number
  wouldPlayAgain: boolean
  notes?: string
  createdAt: string
}

export interface BuildSnapshot {
  id: string
  runId: string
  userId: string
  characterClass: DestinyCharacterClass
  subclass: string
  super: string
  aspects: string[]
  fragments: string[]
  abilities: string[]
  exoticArmor: string
  exoticWeapon?: string
  kineticWeapon: string
  energyWeapon: string
  powerWeapon: string
  armorMods: string[]
  artifactPerks: string[]
  stats: Record<string, number>
  activityId: number
  activityName: string
  difficulty: Difficulty
  completedAt: string
  durationSeconds: number
  deaths: number
  fireteamComposition: string
}

export interface SeasonPrizeRules {
  raid: { first: string; second: string; thirdToFifth: string; participation: string }
  dungeon: { first: string; second: string; thirdToFifth: string; participation: string }
  fullClanTeam: { first: string; second: string; third: string }
}

export interface SeasonWinner {
  category: LeaderboardCategory
  rank: number
  displayName: string
  clanTag?: string
  prize: string
  seasonId: string
}

export interface Season {
  id: string
  name: string
  startDate: string
  endDate: string
  status: 'active' | 'upcoming' | 'archived'
  prizeRules: SeasonPrizeRules
  winners?: SeasonWinner[]
}

export interface AdminReviewRecord {
  id: string
  runId: string
  suspiciousScore: number
  aiSummary: string
  status: 'pending' | 'approved' | 'rejected'
  adminId?: string
  decision?: 'approve' | 'reject' | 'override_points' | 'checkpoint_non_scoring'
  notes?: string
  reviewedAt?: string
  run?: RunRecord
}

export interface PlayerProfile extends DestinyUser {
  raidPoints: number
  dungeonPoints: number
  fullClanPoints: number
  verifiedClears: number
  reputationScore: number
  badges: string[]
  favoriteActivities: string[]
  favoriteTeammates: string[]
  recentRuns: RunRecord[]
  topCompletions: { activityName: string; durationSeconds: number; completedAt: string }[]
  prizeEligibility: string
  currentLoadout?: BuildSnapshot
}

export interface BuildIntelligenceCard {
  id: string
  buildName: string
  activityName: string
  characterClass: DestinyCharacterClass
  subclass: string
  exoticArmor: string
  exoticWeapon?: string
  weapons: string[]
  keyStats: Record<string, number>
  averageClearSeconds: number
  usageRatePercent: number
  successRatePercent: number
  deathRatePercent: number
  topTeamName: string
  fireteamType: 'solo_friendly' | 'clan' | 'mixed'
  role: 'dps' | 'support' | 'balanced'
}

export interface ExternalBuildSource {
  id: string
  title: string
  source: string
  sourceUrl: string
  class: DestinyCharacterClass
  subclass: string
  lastChecked: string
  approved: boolean
}

export interface ClanProfile {
  id: string
  name: string
  tag: string
  emblemUrl?: string
  memberCount: number
  points: number
  fullClanClears: number
  recruitmentOpen: boolean
  avgRaidClearSeconds: number
  avgDungeonClearSeconds: number
  topMembers: { displayName: string; points: number; emblemUrl?: string }[]
  achievements: string[]
}

export interface OverviewPayload {
  raidTop10: LeaderboardEntry[]
  dungeonTop10: LeaderboardEntry[]
  clanTop5: LeaderboardEntry[]
  recentRuns: RunRecord[]
  featuredRaid: { name: string; difficulty: Difficulty; resetsIn: string }
  featuredDungeon: { name: string; difficulty: Difficulty; resetsIn: string }
  season: Season
  seasonCountdown: { days: number; hours: number; label: string }
  prizeSummary: string
  lookingForGroup: FireteamLobby[]
  trendingBuilds: BuildIntelligenceCard[]
  bungieApiConfigured: boolean
}

export interface LeaderboardFilters {
  period: LeaderboardPeriod
  category: LeaderboardCategory
  activity?: string
  difficulty?: Difficulty
  clanOnly?: boolean
  randoFriendly?: boolean
  platform?: DestinyPlatform
  characterClass?: DestinyCharacterClass
}
