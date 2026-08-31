import test from 'node:test'
import assert from 'node:assert/strict'
import { isHighPotential, opportunityScore } from '@/lib/tradebot/opportunity'
import { parseRssItems, toneFromHeadlines } from '@/lib/tradebot/news'

test('new listings with upside outrank dumps in old majors', () => {
  const fresh = opportunityScore({
    dayChangePct: 8,
    barsCount: 12,
    isNewListing: true,
    assetClass: 'equity',
    symbol: 'NEW.P.V',
  })
  const dump = opportunityScore({
    dayChangePct: -8,
    barsCount: 200,
    isNewListing: false,
    assetClass: 'equity',
    symbol: 'VFV.TO',
  })
  assert.ok(fresh > dump)
  assert.equal(
    isHighPotential({
      dayChangePct: 8,
      barsCount: 12,
      isNewListing: true,
      assetClass: 'equity',
      symbol: 'NEW.P.V',
    }),
    true
  )
})

test('negative news knocks a new name off high potential', () => {
  assert.equal(
    isHighPotential({
      dayChangePct: 20,
      barsCount: 8,
      isNewListing: true,
      assetClass: 'crypto',
      symbol: 'PEPE-CAD',
      newsTone: 'negative',
    }),
    false
  )
})

test('headline tone picks up catalysts and fraud language', () => {
  assert.equal(toneFromHeadlines(['Company wins offtake contract for new mine']), 'positive')
  assert.equal(toneFromHeadlines(['Regulator opens fraud investigation after halt']), 'negative')
  assert.equal(toneFromHeadlines(['Pair lists on Kraken after mainnet upgrade']), 'positive')
  assert.equal(toneFromHeadlines(['Market closed for a holiday']), 'quiet')
})

test('parses Google-style RSS items', () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>Acme wins TSX listing</title><link>https://example.com/a</link><pubDate>Mon, 31 Aug 2026</pubDate></item>
    <item><title><![CDATA[Bitcoin ETF inflows]]></title><link>https://example.com/b</link></item>
  </channel></rss>`
  const items = parseRssItems(xml, 3)
  assert.equal(items.length, 2)
  assert.equal(items[0].title, 'Acme wins TSX listing')
  assert.equal(items[1].title, 'Bitcoin ETF inflows')
})
