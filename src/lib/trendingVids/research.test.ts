import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getTrendingVidsPlatform,
  isTrendingVidsPlatformId,
  TRENDING_VIDS_PLATFORMS,
} from '@/lib/trendingVids/platforms'
import {
  normalizeTrendItem,
  normalizeTrendingVidsResult,
  parseTrendingVidsJson,
  TRENDING_VIDS_COUNT,
} from '@/lib/trendingVids/research'

test('isTrendingVidsPlatformId accepts the six surfaces', () => {
  assert.equal(TRENDING_VIDS_PLATFORMS.length, 6)
  for (const id of ['tiktok', 'youtube', 'instagram', 'facebook', 'reddit', 'twitter']) {
    assert.equal(isTrendingVidsPlatformId(id), true)
  }
  assert.equal(isTrendingVidsPlatformId('kick'), false)
})

test('parseTrendingVidsJson unwraps markdown fences and balanced objects', () => {
  const fenced = '```json\n{"overview":"ok","trends":[]}\n```'
  assert.deepEqual(parseTrendingVidsJson(fenced), { overview: 'ok', trends: [] })

  const noisy = 'Here you go\n{"overview":"live","trends":[{"title":"A"}]}\nThanks'
  const parsed = parseTrendingVidsJson(noisy) as { overview: string }
  assert.equal(parsed.overview, 'live')
})

test('normalizeTrendItem drops junk URLs and infers video kind', () => {
  const youtube = getTrendingVidsPlatform('youtube')!
  const item = normalizeTrendItem(
    {
      kind: 'video',
      title: 'MrBeast challenge',
      creator: 'MrBeast',
      summary: 'A huge challenge video',
      whyTrending: 'Exploding on Trending',
      url: 'javascript:alert(1)',
      tags: ['#viral', 'challenge'],
      metric: '12M views',
    },
    1,
    youtube
  )
  assert.ok(item)
  assert.equal(item.kind, 'video')
  assert.equal(item.url, '')
  assert.deepEqual(item.tags, ['viral', 'challenge'])
})

test('normalizeTrendingVidsResult keeps top 5 and requires at least 3', () => {
  const tiktok = getTrendingVidsPlatform('tiktok')!
  const tooFew = normalizeTrendingVidsResult({
    raw: { overview: 'quiet', trends: [{ title: 'one' }, { title: 'two' }] },
    platform: tiktok,
    sources: [],
    searchQueries: [],
    model: 'test',
    usedGoogleSearch: false,
  })
  assert.equal(tooFew, null)

  const extra = Array.from({ length: 8 }, (_, i) => ({
    kind: i % 2 === 0 ? 'video' : 'sound',
    title: `Trend ${i + 1}`,
    summary: 'A clip',
    whyTrending: 'Going around',
    url: 'https://www.tiktok.com/@user/video/1',
  }))
  const result = normalizeTrendingVidsResult({
    raw: { overview: 'Busy week on TikTok', trends: extra },
    platform: tiktok,
    sources: [{ title: 'TikTok', uri: 'https://www.tiktok.com/trending' }],
    searchQueries: ['tiktok trending today'],
    model: 'gemini-2.5-flash',
    usedGoogleSearch: true,
  })
  assert.ok(result)
  assert.equal(result.trends.length, TRENDING_VIDS_COUNT)
  assert.equal(result.trends[4]?.rank, 5)
  assert.equal(result.trends[0]?.url, 'https://www.tiktok.com/@user/video/1')
})
