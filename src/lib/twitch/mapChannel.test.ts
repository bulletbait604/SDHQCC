import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveSiteRole } from '@/lib/home/ownerIdentity'
import {
  TWITCH_SCOPES,
  buildTwitchAuthorizeUrl,
  twitchRedirectUri,
} from './oauth'
import {
  TWITCH_BOARDS,
  buildTwitchSnapshot,
  helixThumbnail,
  insightsFromTwitch,
  mapBitsEntries,
  mapTwitchClips,
  pickPreviewImage,
  readHelixTotal,
  readLatestArchive,
  readSubscriberTotal,
  readTwitchChannel,
  readTwitchProfile,
  readTwitchStream,
  twitchAccountUsername,
} from './mapChannel'

test('Twitch authorize URL requests only the Home scopes and a state value', () => {
  const url = new URL(
    buildTwitchAuthorizeUrl({
      clientId: 'client',
      redirectUri: 'https://sdcreatorcorner.com/auth/twitch/callback',
      state: 'abc123',
    })
  )
  assert.equal(url.origin + url.pathname, 'https://id.twitch.tv/oauth2/authorize')
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('client_id'), 'client')
  assert.equal(url.searchParams.get('state'), 'abc123')
  assert.equal(url.searchParams.get('scope'), TWITCH_SCOPES.join(' '))
  assert.equal(url.searchParams.get('scope')?.includes('user:read:email'), false)
  assert.equal(twitchRedirectUri('https://sdcreatorcorner.com'), 'https://sdcreatorcorner.com/auth/twitch/callback')
})

test('a Twitch login does not inherit the Kick owner allowlist', () => {
  assert.equal(resolveSiteRole('bulletbait604', 'free'), 'owner')
  assert.equal(resolveSiteRole('bulletbait604', 'free', 'kick'), 'owner')
  assert.equal(resolveSiteRole('bulletbait604', 'free', 'twitch'), 'free')
  assert.equal(resolveSiteRole('bulletbait604', 'subscriber', 'twitch'), 'subscriber')
  assert.equal(twitchAccountUsername('99'), 'twitch:99')
})

test('Helix follower total and subscriber n/a mapping', () => {
  assert.equal(readHelixTotal({ total: 1200, data: [] }), 1200)
  assert.deepEqual(readSubscriberTotal(200, { total: 40, data: [] }), { count: 40, unavailable: false })
  assert.deepEqual(readSubscriberTotal(403, { error: 'not affiliate' }), { count: null, unavailable: true })
})

test('category, last live, and preview come from channel, stream, and archive', () => {
  const profile = readTwitchProfile({
    data: [
      {
        id: '9',
        login: 'Preview',
        display_name: 'Preview',
        description: 'Story games.',
        profile_image_url: 'https://cdn.example/p.png',
        offline_image_url: 'https://cdn.example/off.png',
      },
    ],
  })
  assert.ok(profile)
  assert.equal(profile.login, 'preview')
  assert.equal(readTwitchChannel({ data: [{ game_name: 'Just Chatting', title: 'Hello' }] }).gameName, 'Just Chatting')

  const live = readTwitchStream({
    data: [
      {
        started_at: '2026-11-16T12:00:00Z',
        title: 'Live now',
        game_name: 'Minecraft',
        viewer_count: 12,
        thumbnail_url: 'https://static.example/live-{width}x{height}.jpg',
      },
    ],
  })
  assert.equal(live.isLive, true)
  assert.equal(live.thumbnailUrl, 'https://static.example/live-640x360.jpg')

  const archive = readLatestArchive({
    data: [
      {
        created_at: '2026-11-10T01:00:00Z',
        title: 'Yesterday',
        thumbnail_url: 'https://static.example/vod-%{width}x%{height}.jpg',
      },
    ],
  })
  assert.equal(archive.thumbnailUrl, 'https://static.example/vod-640x360.jpg')
  assert.equal(
    pickPreviewImage({
      isLive: true,
      liveThumbnail: live.thumbnailUrl,
      vodThumbnail: archive.thumbnailUrl,
      offlineImage: profile.offlineImageUrl,
    }),
    live.thumbnailUrl
  )
  assert.equal(
    pickPreviewImage({
      isLive: false,
      liveThumbnail: null,
      vodThumbnail: archive.thumbnailUrl,
      offlineImage: profile.offlineImageUrl,
    }),
    archive.thumbnailUrl
  )
  assert.equal(
    pickPreviewImage({ isLive: false, liveThumbnail: null, vodThumbnail: null, offlineImage: profile.offlineImageUrl }),
    profile.offlineImageUrl
  )

  const offline = buildTwitchSnapshot({
    profile,
    channel: { gameName: 'Just Chatting', title: 'Hello', description: null },
    live: readTwitchStream({ data: [] }),
    archive,
    followers: 80,
    subscribers: { count: null, unavailable: true },
  })
  assert.equal(offline.source, 'twitch-helix')
  assert.equal(offline.category, 'Just Chatting')
  assert.equal(offline.lastLiveAt, '2026-11-10T01:00:00Z')
  assert.equal(offline.startedAt, null)
  assert.equal(offline.subscriberUnavailable, true)
  assert.equal(offline.previewImageUrl, archive.thumbnailUrl)
  assert.equal(offline.playerEmbedUrl, '')
  assert.equal(helixThumbnail(null), null)
})

test('bits leaderboard maps logins and gifted subs stay unavailable', () => {
  const entries = mapBitsEntries({
    data: [
      { user_id: '2', user_login: 'cheer1', rank: 1, score: 500 },
      { user_id: '3', user_name: 'cheer2', rank: 2, score: 100 },
    ],
  })
  assert.equal(entries.length, 2)
  assert.equal(entries[0]?.username, 'cheer1')
  assert.equal(entries[0]?.quantity, 500)
  assert.equal(entries[0]?.profileUrl, 'https://www.twitch.tv/cheer1')
  assert.match(TWITCH_BOARDS.left.empty, /does not publish a gifted-sub leaderboard/i)
  assert.equal(TWITCH_BOARDS.right.title, 'Bits')
})

test('clips and insights use only the fields Helix returned', () => {
  const clips = mapTwitchClips({
    data: [{ id: 'c1', url: 'https://clips.twitch.tv/c1', title: 'Nice', view_count: 4, duration: 12.2 }],
  })
  assert.equal(clips[0]?.clipUrl, 'https://clips.twitch.tv/c1')
  assert.equal(clips[0]?.videoUrl, null)
  const insights = insightsFromTwitch({
    description: 'I play story games.',
    gameName: 'Hades',
    recentCategories: ['Hades II'],
    title: null,
  })
  assert.match(insights.streamerBackground, /story games/)
  assert.deepEqual(insights.favoriteGames, ['Hades', 'Hades II'])
  assert.match(insights.schedule, /does not publish/i)
})
