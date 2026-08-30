import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getTrendingVidsPlatform,
  isTrendingVidsPlatformId,
  MAX_TRENDING_VIDS_PROMPT_CHARS,
  normalizeTrendingVidsPrompt,
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
  assert.equal(result.prompt, '')
})

test('normalizeTrendingVidsPrompt trims, collapses space, and caps length', () => {
  assert.equal(normalizeTrendingVidsPrompt('  FPS   gaming  '), 'FPS gaming')
  assert.equal(normalizeTrendingVidsPrompt(null), '')
  assert.equal(normalizeTrendingVidsPrompt(12), '')
  const long = 'x'.repeat(MAX_TRENDING_VIDS_PROMPT_CHARS + 40)
  assert.equal(normalizeTrendingVidsPrompt(long).length, MAX_TRENDING_VIDS_PROMPT_CHARS)
})

test('normalizeTrendingVidsResult echoes the creator focus prompt', () => {
  const youtube = getTrendingVidsPlatform('youtube')!
  const result = normalizeTrendingVidsResult({
    raw: {
      overview: 'Horror shorts are popping',
      trends: [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }],
    },
    platform: youtube,
    sources: [],
    searchQueries: [],
    model: 'test',
    usedGoogleSearch: true,
    prompt: '  horror shorts  ',
  })
  assert.ok(result)
  assert.equal(result.prompt, 'horror shorts')
})

