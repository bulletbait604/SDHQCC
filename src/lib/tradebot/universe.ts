import clientPromise from '@/lib/mongodb'

export type ListedExchange = 'TSX' | 'TSXV'

export type ListedName = {
  symbol: string
  name: string
  exchange: ListedExchange
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const UNIVERSE_COL = 'tradebotUniverse'
const SCAN_STATE_COL = 'tradebotScanState'
const SCAN_STATE_ID = 'cad-scan'
const NEW_LISTING_DAYS = 21
const UNIVERSE_TTL_MS = 6 * 60 * 60 * 1000

/** Warrants, rights, notes, preferreds, and USD-quoted TSX lines stay off the CAD book. */
export function shouldSkipInstrument(raw: string): boolean {
  const s = raw.trim().toUpperCase()
  if (!s) return true
  if (/\.U$/.test(s)) return true
  if (/\.(WT|WTA|WTB|WS|W|RT|RTS|DB|NT|PR|PF)[A-Z0-9]*$/.test(s)) return true
  return false
}

export function listedSymbol(raw: string, exchange: 'tsx' | 'tsxv'): string {
  const base = raw.trim().toUpperCase()
  return `${base}${exchange === 'tsxv' ? '.V' : '.TO'}`
}

export function parseTmxDirectory(body: unknown, exchange: 'tsx' | 'tsxv'): ListedName[] {
  const rec = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const results = Array.isArray(rec.results) ? rec.results : []
  const out: ListedName[] = []
  const seen = new Set<string>()
  for (const row of results) {
    if (!row || typeof row !== 'object') continue
    const company = row as Record<string, unknown>
    const instruments = Array.isArray(company.instruments) && company.instruments.length
      ? company.instruments
      : [{ symbol: company.symbol, name: company.name }]
    for (const inst of instruments) {
      const item = inst && typeof inst === 'object' ? (inst as Record<string, unknown>) : {}
      const raw = String(item.symbol || company.symbol || '').trim().toUpperCase()
      if (shouldSkipInstrument(raw)) continue
      const symbol = listedSymbol(raw, exchange)
      if (seen.has(symbol)) continue
      seen.add(symbol)
      out.push({
        symbol,
        name: String(item.name || company.name || symbol),
        exchange: exchange === 'tsxv' ? 'TSXV' : 'TSX',
      })
    }
  }
  return out
}

async function fetchTmx(exchange: 'tsx' | 'tsxv'): Promise<ListedName[]> {
  const url = `https://www.tsx.com/json/company-directory/search/${exchange}/%5E*`
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`TMX ${exchange} HTTP ${res.status}`)
  return parseTmxDirectory(await res.json(), exchange)
}

async function universeCol() {
  return (await clientPromise).db('sdhq').collection(UNIVERSE_COL)
}

async function scanStateCol() {
  return (await clientPromise).db('sdhq').collection(SCAN_STATE_COL)
}

export type UniverseDoc = ListedName & {
  seeded: boolean
  firstSeenAt: string
  lastSeenAt: string
  lastPrice?: number
  previousClose?: number
  dayChangePct?: number
  barsCount?: number
  score?: number
  scannedAt?: string
}

export type ScanState = {
  id: string
  offset: number
  lastUniverseAt: string
  lastScanAt: string
  lastBatch: string[]
}

export function isNewListing(doc: { seeded?: boolean; firstSeenAt?: string }, now = Date.now()): boolean {
  if (doc.seeded) return false
  const seen = Date.parse(String(doc.firstSeenAt || ''))
  if (!Number.isFinite(seen)) return false
  return now - seen < NEW_LISTING_DAYS * 24 * 60 * 60 * 1000
}

export async function refreshListedUniverse(): Promise<{ universe: number; newListings: number; refreshed: boolean }> {
  const stateCol = await scanStateCol()
  const uniCol = await universeCol()
  const state = (await stateCol.findOne({ id: SCAN_STATE_ID })) as ScanState | null
  const stale =
    !state?.lastUniverseAt || Date.now() - Date.parse(state.lastUniverseAt) > UNIVERSE_TTL_MS
  const existing = await uniCol.countDocuments()
  if (!stale && existing > 0) {
    const newListings = await countNewListings()
    return { universe: existing, newListings, refreshed: false }
  }

  const [tsx, tsxv] = await Promise.all([fetchTmx('tsx'), fetchTmx('tsxv')])
  const listed = [...tsx, ...tsxv]
  if (!listed.length) {
    return { universe: existing, newListings: await countNewListings(), refreshed: false }
  }

  const bootstrap = existing === 0
  const now = new Date().toISOString()
  const ops = listed.map((row) => ({
    updateOne: {
      filter: { symbol: row.symbol },
      update: {
        $set: {
          symbol: row.symbol,
          name: row.name,
          exchange: row.exchange,
          lastSeenAt: now,
        },
        $setOnInsert: {
          firstSeenAt: now,
          seeded: bootstrap,
        },
      },
      upsert: true,
    },
  }))
  const chunk = 500
  for (let i = 0; i < ops.length; i += chunk) {
    await uniCol.bulkWrite(ops.slice(i, i + chunk), { ordered: false })
  }
  await stateCol.updateOne(
    { id: SCAN_STATE_ID },
    { $set: { id: SCAN_STATE_ID, lastUniverseAt: now, lastScanAt: state?.lastScanAt || '', offset: state?.offset || 0, lastBatch: state?.lastBatch || [] } },
    { upsert: true }
  )
  return { universe: listed.length, newListings: await countNewListings(), refreshed: true }
}

export async function countNewListings(): Promise<number> {
  const cutoff = new Date(Date.now() - NEW_LISTING_DAYS * 24 * 60 * 60 * 1000).toISOString()
  return (await universeCol()).countDocuments({ seeded: false, firstSeenAt: { $gte: cutoff } })
}

export async function universeStats(): Promise<{ universe: number; newListings: number; offset: number }> {
  const uniCol = await universeCol()
  const state = (await scanStateCol().then((c) => c.findOne({ id: SCAN_STATE_ID }))) as ScanState | null
  return {
    universe: await uniCol.countDocuments(),
    newListings: await countNewListings(),
    offset: Number(state?.offset || 0),
  }
}

export async function listUniverseSymbols(): Promise<string[]> {
  const rows = await (await universeCol()).find({}, { projection: { symbol: 1 } }).sort({ symbol: 1 }).toArray()
  return rows.map((r) => String(r.symbol || '')).filter(Boolean)
}

export async function listNewListingSymbols(limit = 40): Promise<string[]> {
  const cutoff = new Date(Date.now() - NEW_LISTING_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const rows = await (await universeCol())
    .find({ seeded: false, firstSeenAt: { $gte: cutoff } }, { projection: { symbol: 1 } })
    .sort({ firstSeenAt: -1 })
    .limit(limit)
    .toArray()
  return rows.map((r) => String(r.symbol || '')).filter(Boolean)
}

export async function takeScanSlice(batch: number): Promise<{ symbols: string[]; offset: number; total: number }> {
  const symbols = await listUniverseSymbols()
  const total = symbols.length
  if (!total) return { symbols: [], offset: 0, total: 0 }
  const stateCol = await scanStateCol()
  const state = (await stateCol.findOne({ id: SCAN_STATE_ID })) as ScanState | null
  const offset = Number(state?.offset || 0) % total
  const slice: string[] = []
  for (let i = 0; i < Math.min(batch, total); i++) {
    slice.push(symbols[(offset + i) % total])
  }
  const next = (offset + slice.length) % total
  await stateCol.updateOne(
    { id: SCAN_STATE_ID },
    {
      $set: {
        id: SCAN_STATE_ID,
        offset: next,
        lastScanAt: new Date().toISOString(),
        lastBatch: slice,
      },
    },
    { upsert: true }
  )
  return { symbols: slice, offset, total }
}

export async function saveScanQuotes(
  quotes: Array<{
    symbol: string
    lastPrice: number
    previousClose: number
    dayChangePct: number
    barsCount: number
    score: number
  }>
): Promise<void> {
  if (!quotes.length) return
  const col = await universeCol()
  const now = new Date().toISOString()
  await col.bulkWrite(
    quotes.map((q) => ({
      updateOne: {
        filter: { symbol: q.symbol },
        update: {
          $set: {
            lastPrice: q.lastPrice,
            previousClose: q.previousClose,
            dayChangePct: q.dayChangePct,
            barsCount: q.barsCount,
            score: q.score,
            scannedAt: now,
          },
        },
      },
    })),
    { ordered: false }
  )
}

export async function rankedEquityCache(limit: number): Promise<UniverseDoc[]> {
  const rows = await (await universeCol())
    .find({ lastPrice: { $gt: 0 } })
    .sort({ score: -1, scannedAt: -1 })
    .limit(limit)
    .toArray()
  return rows as unknown as UniverseDoc[]
}

const CRYPTO_UNI_COL = 'tradebotCryptoUniverse'

async function cryptoUniCol() {
  return (await clientPromise).db('sdhq').collection(CRYPTO_UNI_COL)
}

/** Persist Kraken CAD pairs so coins that appear after bootstrap count as new currencies. */
export async function rememberCryptoPairs(symbols: string[]): Promise<{ newCoins: string[] }> {
  const unique = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)))
  if (!unique.length) return { newCoins: [] }
  const col = await cryptoUniCol()
  const existing = await col.countDocuments()
  const bootstrap = existing === 0
  const now = new Date().toISOString()
  await col.bulkWrite(
    unique.map((symbol) => ({
      updateOne: {
        filter: { symbol },
        update: {
          $set: { symbol, lastSeenAt: now },
          $setOnInsert: { firstSeenAt: now, seeded: bootstrap },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  )
  const cutoff = new Date(Date.now() - NEW_LISTING_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const fresh = await col
    .find({ seeded: false, firstSeenAt: { $gte: cutoff } }, { projection: { symbol: 1 } })
    .toArray()
  return { newCoins: fresh.map((r) => String(r.symbol || '')).filter(Boolean) }
}
