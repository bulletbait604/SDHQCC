import type { KickChannelSnapshot, KickClipCard } from '@/lib/kick/channelSnapshot'
import type { KickLeaderboard } from '@/lib/kick/leaderboard'
import type { ChannelInsights } from '@/lib/home/channelInsightsTypes'
import { twitchClientId } from './oauth'
import { getTwitchAccessToken } from './tokens'
import {
  TWITCH_BOARDS,
  type TwitchHomeBoards,
  buildTwitchSnapshot,
  insightsFromTwitch,
  mapBitsEntries,
  mapTwitchClips,
  readHelixTotal,
  readLatestArchive,
  readSubscriberTotal,
  readTwitchChannel,
  readTwitchProfile,
  readTwitchStream,
  twitchLeaderboard,
} from './mapChannel'

export type TwitchDashboard = {
  channel: KickChannelSnapshot
  leaderboard: KickLeaderboard
  boards: TwitchHomeBoards
  insights: ChannelInsights
  clips: KickClipCard[]
}

async function helix(path: string, token: string): Promise<{ status: number; body: unknown }> {
  const clientId = twitchClientId()
  if (!clientId) return { status: 503, body: null }
  const response = await fetch(`https://api.twitch.tv/helix/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id': clientId,
    },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}

export async function loadTwitchDashboard(twitchId: string): Promise<TwitchDashboard> {
  const token = await getTwitchAccessToken(twitchId)
  if (!token) {
    throw new Error('Twitch login expired. Log in with Twitch again.')
  }

  const [users, channels, streams, videos, followers, subscriptions, bitsWeek, bitsMonth, bitsAll, clips] =
    await Promise.all([
      helix(`users?id=${encodeURIComponent(twitchId)}`, token),
      helix(`channels?broadcaster_id=${encodeURIComponent(twitchId)}`, token),
      helix(`streams?user_id=${encodeURIComponent(twitchId)}`, token),
      helix(`videos?user_id=${encodeURIComponent(twitchId)}&type=archive&first=1`, token),
      helix(`channels/followers?broadcaster_id=${encodeURIComponent(twitchId)}&first=1`, token),
      helix(`subscriptions?broadcaster_id=${encodeURIComponent(twitchId)}&first=1`, token),
      helix('bits/leaderboard?count=10&period=week', token),
      helix('bits/leaderboard?count=10&period=month', token),
      helix('bits/leaderboard?count=10&period=all', token),
      helix(`clips?broadcaster_id=${encodeURIComponent(twitchId)}&first=20`, token),
    ])

  const profile = readTwitchProfile(users.body)
  if (!profile || users.status >= 400) {
    throw new Error('Twitch did not return this channel.')
  }

  const channelInfo = readTwitchChannel(channels.body)
  const live = readTwitchStream(streams.body)
  const archive = readLatestArchive(videos.body)
  const channel = buildTwitchSnapshot({
    profile,
    channel: channelInfo,
    live,
    archive,
    followers: followers.status < 400 ? readHelixTotal(followers.body) : null,
    subscribers: readSubscriberTotal(subscriptions.status, subscriptions.body),
  })
  const leaderboard = twitchLeaderboard({
    week: bitsWeek.status < 400 ? mapBitsEntries(bitsWeek.body) : [],
    month: bitsMonth.status < 400 ? mapBitsEntries(bitsMonth.body) : [],
    lifetime: bitsAll.status < 400 ? mapBitsEntries(bitsAll.body) : [],
  })
  const insights = insightsFromTwitch({
    description: channel.description,
    gameName: channel.category,
    recentCategories: channel.recentCategories,
    title: channel.streamTitle,
  })

  return {
    channel,
    leaderboard,
    boards: TWITCH_BOARDS,
    insights,
    clips: clips.status < 400 ? mapTwitchClips(clips.body) : [],
  }
}
