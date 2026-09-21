import test from 'node:test'
import assert from 'node:assert/strict'
import { mapWebChannel, mergeKickChannels, parseClipList } from './channelSnapshot'

test('mapWebChannel treats livestream presence as live and keeps previous livestream as last live', () => {
  const mapped = mapWebChannel(
    {
      slug: 'demo',
      user: {
        username: 'Demo',
        profile_pic: 'https://files.kick.com/pic.png',
        bio: 'FPS nights',
        instagram: 'demo.ig',
        twitter: 'demo_x',
      },
      livestream: null,
      previous_livestream: { created_at: '2026-09-20T01:00:00Z', session_title: 'Ranked' },
      followers_count: 1200,
      id: 44,
      banner_image: { url: 'https://files.kick.com/banner.png' },
      offline_banner_image: { src: 'https://files.kick.com/offline.png' },
      recent_categories: [
        { name: 'Wardogs', is_fallback: false },
        { name: 'Slots', is_fallback: true },
      ],
    },
    'demo'
  )
  assert.equal(mapped.isLive, false)
  assert.equal(mapped.lastLiveAt, '2026-09-20T01:00:00Z')
  assert.equal(mapped.followersCount, 1200)
  assert.equal(mapped.channelId, '44')
  assert.equal(mapped.description, 'FPS nights')
  assert.equal(mapped.bannerUrl, 'https://files.kick.com/offline.png')
  assert.deepEqual(mapped.recentCategories, ['Wardogs'])
  assert.equal(mapped.category, 'Wardogs')
  assert.equal(mapped.socials[0]?.network, 'Instagram')
  assert.equal(mapped.socials[0]?.username, 'demo.ig')
  assert.equal(mapped.socials[1]?.network, 'X')
})

test('mergeKickChannels prefers official live state and web bio/followers', () => {
  const official = mapWebChannel(
    {
      slug: 'demo',
      user: { username: 'demo' },
      livestream: { session_title: 'Live now', viewer_count: 80, created_at: '2026-09-21T12:00:00Z' },
    },
    'demo'
  )
  official.source = 'kick-public-api'
  official.description = ''
  official.followersCount = null
  official.bannerUrl = 'https://files.kick.com/official-banner.png'
  official.isLive = true

  const web = mapWebChannel(
    {
      slug: 'demo',
      user: { username: 'DemoName', bio: 'I play FPS and variety. https://x.com/demo' },
      livestream: { session_title: 'Live now', viewer_count: 80 },
      followers_count: 2500,
      id: 9,
    },
    'demo'
  )

  const merged = mergeKickChannels(official, web)
  assert.equal(merged.isLive, true)
  assert.equal(merged.description.includes('FPS'), true)
  assert.equal(merged.followersCount, 2500)
  assert.equal(merged.displayName, 'DemoName')
  assert.equal(merged.bannerUrl, 'https://files.kick.com/official-banner.png')
})

test('parseClipList reads nested clips arrays', () => {
  const clips = parseClipList(
    {
      clips: [
        {
          id: 'c1',
          title: 'Ace',
          thumbnail_url: 'https://files.kick.com/t.png',
          clip_url: 'https://kick.com/demo?clip=c1',
          views: 12,
          duration: 18,
        },
      ],
    },
    'demo'
  )
  assert.equal(clips.length, 1)
  assert.equal(clips[0]?.id, 'c1')
  assert.equal(clips[0]?.views, 12)
  assert.equal(clips[0]?.durationSeconds, 18)
})
