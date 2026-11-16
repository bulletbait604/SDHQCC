import type { KickChannelSnapshot, KickClipCard } from '@/lib/kick/channelSnapshot'
import { emptyPeriod, type KickLeaderboard, type KickLeaderboardEntry } from '@/lib/kick/leaderboard'
import type { ChannelInsights } from '@/lib/home/channelInsightsTypes'

export type TwitchBoardCopy = {
  title: string
  unit: string
  empty: string
}

export type TwitchHomeBoards = {
  left: TwitchBoardCopy
  right: TwitchBoardCopy
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function rows(payload: unknown): Record<string, unknown>[] {
  const root = asRecord(payload)
  const data = root?.data
  if (!Array.isArray(data)) return []
  return data.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row))
}

/** Stable site username. Never the raw Twitch login, so it cannot collide with a Kick account. */
export function twitchAccountUsername(twitchId: string): string {
  return `twitch:${twitchId}`
}

export function helixThumbnail(url: string | null, width = 640, height = 360): string | null {
  if (!url) return null
  return url
    .replace(/\{width\}|%\{width\}/g, String(width))
    .replace(/\{height\}|%\{height\}/g, String(height))
}

export function readHelixTotal(payload: unknown): number | null {
  const total = asNumber(asRecord(payload)?.total)
  return total != null && total >= 0 ? total : null
}

/** Affiliate and partner channels return a total. Everyone else is n/a, not zero. */
export function readSubscriberTotal(
  status: number,
  payload: unknown
): { count: number | null; unavailable: boolean } {
  if (status === 401 || status === 403) return { count: null, unavailable: true }
  const total = readHelixTotal(payload)
  if (total == null) return { count: null, unavailable: true }
  return { count: total, unavailable: false }
}

export type TwitchProfile = {
  id: string
  login: string
  displayName: string
  description: string
  profileImageUrl: string | null
  offlineImageUrl: string | null
  email: string | null
}

export function readTwitchProfile(payload: unknown): TwitchProfile | null {
  const row = rows(payload)[0]
  if (!row) return null
  const id = asString(row.id)
  const login = asString(row.login)?.toLowerCase()
  if (!id || !login) return null
  return {
    id,
    login,
    displayName: asString(row.display_name) || login,
    description: asString(row.description) || '',
    profileImageUrl: asString(row.profile_image_url),
    offlineImageUrl: asString(row.offline_image_url),
    email: asString(row.email),
  }
}

export type TwitchChannelInfo = {
  gameName: string | null
  title: string | null
  description: string | null
}

export function readTwitchChannel(payload: unknown): TwitchChannelInfo {
  const row = rows(payload)[0]
  return {
    gameName: asString(row?.game_name),
    title: asString(row?.title),
    description: asString(row?.description) || asString(row?.broadcaster_language),
  }
}

export type TwitchLive = {
  isLive: boolean
  startedAt: string | null
  title: string | null
  gameName: string | null
  viewerCount: number | null
  thumbnailUrl: string | null
}

export function readTwitchStream(payload: unknown): TwitchLive {
  const row = rows(payload)[0]
  if (!row) {
    return { isLive: false, startedAt: null, title: null, gameName: null, viewerCount: null, thumbnailUrl: null }
  }
  return {
    isLive: true,
    startedAt: asString(row.started_at),
    title: asString(row.title),
    gameName: asString(row.game_name),
    viewerCount: asNumber(row.viewer_count),
    thumbnailUrl: helixThumbnail(asString(row.thumbnail_url)),
  }
}

export type TwitchArchive = {
  createdAt: string | null
  thumbnailUrl: string | null
  title: string | null
  gameName: string | null
}

export function readLatestArchive(payload: unknown): TwitchArchive {
  const row = rows(payload)[0]
  return {
    createdAt: asString(row?.created_at),
    thumbnailUrl: helixThumbnail(asString(row?.thumbnail_url)),
    title: asString(row?.title),
    gameName: asString(row?.game_name) || asString(row?.game),
  }
}

export function pickPreviewImage(input: {
  liveThumbnail: string | null
  vodThumbnail: string | null
  offlineImage: string | null
  isLive: boolean
}): string | null {
  if (input.isLive && input.liveThumbnail) return input.liveThumbnail
  return input.vodThumbnail || input.offlineImage || input.liveThumbnail
}

export function mapBitsEntries(payload: unknown): KickLeaderboardEntry[] {
  return rows(payload)
    .map((row, index) => {
      const login = asString(row.user_login) || asString(row.user_name)
      if (!login) return null
      const score = asNumber(row.score) ?? 0
      return {
        rank: asNumber(row.rank) ?? index + 1,
        userId: asString(row.user_id),
        username: login,
        quantity: score,
        profileUrl: `https://www.twitch.tv/${encodeURIComponent(login)}`,
      } satisfies KickLeaderboardEntry
    })
    .filter((row): row is KickLeaderboardEntry => Boolean(row))
    .slice(0, 10)
}

export function twitchLeaderboard(input: {
  week: KickLeaderboardEntry[]
  month: KickLeaderboardEntry[]
  lifetime: KickLeaderboardEntry[]
}): KickLeaderboard {
  const gifted = emptyPeriod()
  return {
    giftedSubs: gifted,
    kicks: {
      week: input.week,
      month: input.month,
      lifetime: input.lifetime,
      enabled: true,
    },
  }
}

export const TWITCH_BOARDS: TwitchHomeBoards = {
  left: {
    title: 'Gifted subs',
    unit: 'subs',
    empty: 'Twitch does not publish a gifted-sub leaderboard.',
  },
  right: {
    title: 'Bits',
    unit: 'bits',
    empty: 'No bits in this period.',
  },
}

export function mapTwitchClips(payload: unknown): KickClipCard[] {
  return rows(payload)
    .map((row) => {
      const id = asString(row.id)
      const url = asString(row.url)
      if (!id || !url) return null
      const card: KickClipCard = {
        id,
        title: asString(row.title) || 'Clip',
        thumbnailUrl: helixThumbnail(asString(row.thumbnail_url)),
        clipUrl: url,
        videoUrl: null,
        createdAt: asString(row.created_at),
        durationSeconds: asNumber(row.duration),
        views: asNumber(row.view_count),
      }
      return card
    })
    .filter((row): row is KickClipCard => row !== null)
    .slice(0, 25)
}

export function insightsFromTwitch(input: {
  description: string
  gameName: string | null
  recentCategories: string[]
  title: string | null
}): ChannelInsights {
  const games = [...input.recentCategories]
  if (input.gameName && !games.includes(input.gameName)) games.unshift(input.gameName)
  return {
    streamerBackground: input.description.trim() || input.title || 'No channel description on Twitch yet.',
    gameStyles: input.gameName || 'No category on the Twitch channel right now.',
    favoriteGames: games.slice(0, 8),
    schedule: 'Twitch does not publish a weekly schedule on the channel record.',
    socials: [],
    sourceNotes: 'Built from the Twitch channel description, category, and latest archive. No extra research.',
  }
}

export function buildTwitchSnapshot(input: {
  profile: TwitchProfile
  channel: TwitchChannelInfo
  live: TwitchLive
  archive: TwitchArchive
  followers: number | null
  subscribers: { count: number | null; unavailable: boolean }
}): KickChannelSnapshot {
  const category = input.live.gameName || input.channel.gameName
  const recent = [category, input.archive.gameName].filter((name): name is string => Boolean(name))
  const uniqueRecent = Array.from(new Set(recent))
  return {
    slug: input.profile.login,
    displayName: input.profile.displayName,
    profileImageUrl: input.profile.profileImageUrl,
    bannerUrl: input.profile.offlineImageUrl,
    description: input.profile.description || input.channel.description || '',
    isLive: input.live.isLive,
    streamTitle: input.live.title || input.channel.title,
    category,
    viewerCount: input.live.viewerCount,
    startedAt: input.live.isLive ? input.live.startedAt : null,
    lastLiveAt: input.live.isLive ? input.live.startedAt : input.archive.createdAt,
    liveThumbnailUrl: input.live.thumbnailUrl,
    subscriberCount: input.subscribers.count,
    subscriberUnavailable: input.subscribers.unavailable,
    followersCount: input.followers,
    channelId: input.profile.id,
    recentCategories: uniqueRecent,
    socials: [],
    playerEmbedUrl: '',
    previewImageUrl: pickPreviewImage({
      isLive: input.live.isLive,
      liveThumbnail: input.live.thumbnailUrl,
      vodThumbnail: input.archive.thumbnailUrl,
      offlineImage: input.profile.offlineImageUrl,
    }),
    channelUrl: `https://www.twitch.tv/${encodeURIComponent(input.profile.login)}`,
    source: 'twitch-helix',
  }
}
