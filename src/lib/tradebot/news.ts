const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export type NewsTone = 'positive' | 'negative' | 'mixed' | 'quiet'

export type NewsHeadline = {
  title: string
  url: string
  published: string
}

export type NameNews = {
  symbol: string
  query: string
  headlines: NewsHeadline[]
  tone: NewsTone
}

const POSITIVE =
  /\b(approv|award|listing|etf|mainnet|upgrade|surge|breakout|partnership|pumped|ath|contract|offtake)\b/i
const NEGATIVE =
  /\b(halt|cease|fraud|dilut|investigat|bankrupt|delist|hack|lawsuit|rug|honeypot|exploit|scam|collapse|recall|restat)\b/i

export function toneFromHeadlines(titles: string[]): NewsTone {
  let pos = 0
  let neg = 0
  for (const t of titles) {
    if (POSITIVE.test(t)) pos += 1
    if (NEGATIVE.test(t)) neg += 1
  }
  if (!pos && !neg) return 'quiet'
  if (pos && neg) return 'mixed'
  return pos > neg ? 'positive' : 'negative'
}

export function newsQueryFor(symbol: string, name?: string): string {
  const s = symbol.trim().toUpperCase()
  if (s.endsWith('-CAD')) {
    const base = s.replace(/-CAD$/, '')
    const label = base === 'BTC' ? 'Bitcoin' : base === 'ETH' ? 'Ethereum' : base === 'DOGE' ? 'Dogecoin' : base
    return `${label} OR ${base} crypto OR meme coin`
  }
  const ticker = s.replace(/\.(TO|V)$/, '')
  return name ? `${ticker} OR "${name}" TSX OR TSXV` : `${s} OR ${ticker} Canada stock`
}

function decodeXml(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

export function parseRssItems(xml: string, limit = 3): NewsHeadline[] {
  const items: NewsHeadline[] = []
  const blocks = xml.split(/<item[\s>]/i).slice(1)
  for (const block of blocks) {
    const title = decodeXml((block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '')
    const link = decodeXml((block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '')
    const published = decodeXml((block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || '')
    if (!title) continue
    items.push({ title: title.slice(0, 220), url: link.slice(0, 400), published: published.slice(0, 80) })
    if (items.length >= limit) break
  }
  return items
}

async function fetchRss(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`RSS HTTP ${res.status}`)
  return res.text()
}

export async function fetchGoogleNews(query: string, limit = 3): Promise<NewsHeadline[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-CA&gl=CA&ceid=CA:en`
  return parseRssItems(await fetchRss(url), limit)
}

export async function fetchIndustryTape(): Promise<NewsHeadline[]> {
  const queries = [
    'meme coin OR new crypto listing OR solana meme OR base meme',
    'crypto rug pull OR hack OR exploit',
    'Bitcoin Ethereum crypto market',
    'pump fun OR new token launch crypto',
  ]
  const bags = await Promise.all(
    queries.map(async (q) => {
      try {
        return await fetchGoogleNews(q, 2)
      } catch {
        return []
      }
    })
  )
  const seen = new Set<string>()
  const out: NewsHeadline[] = []
  for (const bag of bags) {
    for (const h of bag) {
      const key = h.title.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(h)
      if (out.length >= 8) return out
    }
  }
  return out
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const worker = async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, () => worker()))
  return out
}

export async function fetchNewsForNames(
  names: Array<{ symbol: string; name?: string }>
): Promise<NameNews[]> {
  return mapPool(names, 4, async (row) => {
    const query = newsQueryFor(row.symbol, row.name)
    try {
      const headlines = await fetchGoogleNews(query, 3)
      return {
        symbol: row.symbol,
        query,
        headlines,
        tone: toneFromHeadlines(headlines.map((h) => h.title)),
      }
    } catch {
      return { symbol: row.symbol, query, headlines: [], tone: 'quiet' as const }
    }
  })
}
