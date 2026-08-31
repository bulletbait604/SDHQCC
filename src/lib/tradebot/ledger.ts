import clientPromise from '@/lib/mongodb'
import { TRADEBOT_BASE_CURRENCY } from '@/lib/tradebot/canada'
import { bookIdForMode, bookIdToSave, DESK_ID, LIVE_LEDGER_ID, PAPER_LEDGER_ID } from '@/lib/tradebot/deskBooks'
import { getTradebotSettings, isKrakenLiveAllowed, paperStartMismatchShouldReset } from '@/lib/tradebot/settings'
import { parseVolatility, type VolatilityLevel } from '@/lib/tradebot/volatility'

export type PaperPosition = {
  symbol: string
  qty: number
  avgPrice: number
  stopLoss: number
  takeProfit: number
}

export type OpenDeskOrder = {
  txid: string
  symbol: string
  side: 'BUY' | 'SELL'
  kind: 'entry' | 'stop' | 'take'
  qty: number
  price: number
  placedAt: string
  stopLoss?: number
  takeProfit?: number
}

export type PaperLedger = {
  id: string
  currency: 'CAD'
  cash: number
  startingEquity: number
  dayStartEquity: number
  dayStartDate: string
  halted: boolean
  haltReason: string
  positions: PaperPosition[]
  openOrders: OpenDeskOrder[]
  engineOn: boolean
  liveMode: boolean
  volatility: VolatilityLevel
  krakenSyncedAt?: string
  updatedAt: string
}

export type LedgerFill = {
  at: string
  symbol: string
  side: 'BUY' | 'SELL'
  qty: number
  price: number
  notionalCad: number
  feeCad: number
  stopLoss: number
  takeProfit: number
  reason: string
}

const LEDGER_COL = 'tradebotLedger'
const FILLS_COL = 'tradebotFills'
const CYCLES_COL = 'tradebotCycles'

export { PAPER_LEDGER_ID, LIVE_LEDGER_ID, bookIdForMode }

function torontoDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
}

async function ledgerCol() {
  return (await clientPromise).db('sdhq').collection(LEDGER_COL)
}

async function fillsCol() {
  return (await clientPromise).db('sdhq').collection(FILLS_COL)
}

async function cyclesCol() {
  return (await clientPromise).db('sdhq').collection(CYCLES_COL)
}

function mapLedger(r: Record<string, unknown>, startingCad: number, id: string): PaperLedger {
  const positionsRaw = Array.isArray(r.positions) ? r.positions : []
  return {
    id,
    currency: TRADEBOT_BASE_CURRENCY,
    cash: Number(r.cash ?? startingCad),
    startingEquity: Number(r.startingEquity ?? startingCad),
    dayStartEquity: Number(r.dayStartEquity ?? startingCad),
    dayStartDate: String(r.dayStartDate || torontoDate()),
    halted: Boolean(r.halted),
    haltReason: String(r.haltReason || ''),
    engineOn: Boolean(r.engineOn),
    liveMode: Boolean(r.liveMode),
    volatility: parseVolatility(r.volatility),
    krakenSyncedAt: typeof r.krakenSyncedAt === 'string' ? r.krakenSyncedAt : undefined,
    positions: positionsRaw.map((item) => {
      const rec = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      return {
        symbol: String(rec.symbol || '').toUpperCase(),
        qty: Number(rec.qty || 0),
        avgPrice: Number(rec.avgPrice || 0),
        stopLoss: Number(rec.stopLoss || 0),
        takeProfit: Number(rec.takeProfit || 0),
      }
    }).filter((p) => p.symbol && p.qty > 0),
    openOrders: (Array.isArray(r.openOrders) ? r.openOrders : [])
      .map((item) => {
        const rec = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
        const side = rec.side === 'SELL' ? 'SELL' : 'BUY'
        const kind = rec.kind === 'stop' || rec.kind === 'take' || rec.kind === 'entry' ? rec.kind : 'entry'
        return {
          txid: String(rec.txid || ''),
          symbol: String(rec.symbol || '').toUpperCase(),
          side,
          kind,
          qty: Number(rec.qty || 0),
          price: Number(rec.price || 0),
          placedAt: String(rec.placedAt || ''),
          stopLoss: Number(rec.stopLoss || 0) || undefined,
          takeProfit: Number(rec.takeProfit || 0) || undefined,
        } satisfies OpenDeskOrder
      })
      .filter((o) => o.txid && o.symbol),
    updatedAt: String(r.updatedAt || new Date().toISOString()),
  }
}

export function markToMarket(ledger: PaperLedger, prices: Record<string, number>): number {
  const pos = ledger.positions.reduce((sum, p) => sum + p.qty * (prices[p.symbol] || p.avgPrice), 0)
  return ledger.cash + pos
}

function freshLedger(id: string, startingCad: number, dayStartDate: string): PaperLedger {
  return {
    id,
    currency: 'CAD',
    cash: startingCad,
    startingEquity: startingCad,
    dayStartEquity: startingCad,
    dayStartDate,
    halted: false,
    haltReason: '',
    engineOn: false,
    liveMode: false,
    volatility: 'high',
    positions: [],
    openOrders: [],
    updatedAt: new Date().toISOString(),
  }
}

type DeskState = {
  liveMode: boolean
  engineOn: boolean
  volatility: VolatilityLevel
}

function overlayDesk(book: PaperLedger, desk: DeskState): PaperLedger {
  book.liveMode = desk.liveMode
  book.engineOn = desk.engineOn
  book.volatility = desk.volatility
  return book
}

const HUNT_REV = 2

async function loadDesk(col: Awaited<ReturnType<typeof ledgerCol>>): Promise<DeskState> {
  const desk = await col.findOne({ id: DESK_ID })
  if (desk) {
    let volatility = parseVolatility(desk.volatility)
    if (Number(desk.huntRev) !== HUNT_REV) {
      volatility = 'high'
      await col.updateOne(
        { id: DESK_ID },
        { $set: { volatility: 'high', huntRev: HUNT_REV, updatedAt: new Date().toISOString() } }
      )
    }
    return {
      liveMode: Boolean(desk.liveMode),
      engineOn: Boolean(desk.engineOn),
      volatility,
    }
  }
  const legacy = await col.findOne({ id: PAPER_LEDGER_ID })
  const state: DeskState = {
    liveMode: Boolean(legacy?.liveMode),
    engineOn: Boolean(legacy?.engineOn),
    volatility: 'high',
  }
  await col.updateOne(
    { id: DESK_ID },
    { $set: { id: DESK_ID, ...state, huntRev: HUNT_REV, updatedAt: new Date().toISOString() } },
    { upsert: true }
  )
  return state
}

async function saveDesk(col: Awaited<ReturnType<typeof ledgerCol>>, desk: DeskState): Promise<void> {
  await col.updateOne(
    { id: DESK_ID },
    { $set: { id: DESK_ID, ...desk, updatedAt: new Date().toISOString() } },
    { upsert: true }
  )
}

async function loadBook(
  col: Awaited<ReturnType<typeof ledgerCol>>,
  id: string,
  startingCad: number,
  today: string
): Promise<PaperLedger> {
  const existing = await col.findOne({ id })
  const start = id === LIVE_LEDGER_ID ? 0 : startingCad
  if (!existing) {
    const fresh = freshLedger(id, start, today)
    await col.insertOne({ ...fresh })
    return fresh
  }
  const ledger = mapLedger(existing as Record<string, unknown>, start, id)
  if (id === LIVE_LEDGER_ID && !ledger.krakenSyncedAt) {
    ledger.cash = 0
    ledger.positions = []
    ledger.openOrders = []
    ledger.startingEquity = 0
    ledger.dayStartEquity = 0
  }
  if (id === PAPER_LEDGER_ID && paperStartMismatchShouldReset(false, ledger.startingEquity, startingCad)) {
    const reset = freshLedger(id, startingCad, today)
    await col.replaceOne({ id }, reset, { upsert: true })
    return reset
  }
  if (ledger.dayStartDate !== today) {
    ledger.dayStartDate = today
    ledger.halted = false
    ledger.haltReason = ''
    ledger.updatedAt = new Date().toISOString()
  }
  return ledger
}

export async function loadPaperLedger(): Promise<PaperLedger> {
  const { startingCad } = getTradebotSettings()
  const col = await ledgerCol()
  const today = torontoDate()
  const desk = await loadDesk(col)
  const book = await loadBook(col, bookIdForMode(desk.liveMode), startingCad, today)
  return overlayDesk(book, desk)
}

export async function savePaperLedger(ledger: PaperLedger): Promise<void> {
  ledger.updatedAt = new Date().toISOString()
  const id = bookIdToSave(ledger)
  if (!id) {
    console.error('[tradebot] refused to save', ledger.id, 'as', ledger.liveMode ? 'Real' : 'Fake')
    return
  }
  ledger.id = id
  const col = await ledgerCol()
  const { engineOn: _e, liveMode: _l, volatility: _v, ...book } = ledger
  await col.updateOne({ id }, { $set: { ...book, id } }, { upsert: true })
}

export async function setPaperEngine(on: boolean): Promise<PaperLedger> {
  return setDeskControls({ on })
}

export async function setDeskControls(patch: {
  on?: boolean
  liveMode?: boolean
  volatility?: VolatilityLevel
}): Promise<PaperLedger> {
  const { startingCad } = getTradebotSettings()
  const col = await ledgerCol()
  const today = torontoDate()
  const desk = await loadDesk(col)
  const wasLive = desk.liveMode
  if (typeof patch.on === 'boolean') desk.engineOn = Boolean(patch.on)
  if (typeof patch.liveMode === 'boolean') {
    if (patch.liveMode && !isKrakenLiveAllowed()) {
      throw new Error('Set TRADEBOT_LIVE=true and Kraken API keys before switching to Real money.')
    }
    desk.liveMode = Boolean(patch.liveMode)
    if (patch.liveMode) desk.engineOn = false
    if (patch.liveMode && !wasLive) {
      await col.replaceOne(
        { id: LIVE_LEDGER_ID },
        freshLedger(LIVE_LEDGER_ID, 0, today),
        { upsert: true }
      )
    }
  }
  if (patch.volatility) desk.volatility = parseVolatility(patch.volatility)
  await saveDesk(col, desk)
  const book = await loadBook(col, bookIdForMode(desk.liveMode), startingCad, today)
  return overlayDesk(book, desk)
}

export async function applyFill(params: {
  ledger: PaperLedger
  side: 'BUY' | 'SELL'
  symbol: string
  qty: number
  price: number
  feeBps: number
  stopLoss: number
  takeProfit: number
  reason: string
}): Promise<{ ledger: PaperLedger; fill: LedgerFill }> {
  const qty = params.qty
  const notional = qty * params.price
  const feeCad = notional * (params.feeBps / 10_000)
  const symbol = params.symbol.toUpperCase()
  const positions = [...params.ledger.positions]
  const idx = positions.findIndex((p) => p.symbol === symbol)
  let cash = params.ledger.cash

  if (params.side === 'BUY') {
    const cost = notional + feeCad
    if (params.ledger.cash + 0.01 < cost) {
      throw new Error(`Not enough CAD cash for this buy (need about CA$${cost.toFixed(2)}).`)
    }
    cash -= cost
    if (idx >= 0) {
      const prev = positions[idx]
      const newQty = prev.qty + qty
      positions[idx] = {
        ...prev,
        qty: newQty,
        avgPrice: (prev.avgPrice * prev.qty + params.price * qty) / newQty,
        stopLoss: params.stopLoss,
        takeProfit: params.takeProfit,
      }
    } else {
      positions.push({
        symbol,
        qty,
        avgPrice: params.price,
        stopLoss: params.stopLoss,
        takeProfit: params.takeProfit,
      })
    }
  } else {
    cash += notional - feeCad
    if (idx >= 0) {
      const prev = positions[idx]
      const left = prev.qty - qty
      if (left <= 1e-9) positions.splice(idx, 1)
      else positions[idx] = { ...prev, qty: left }
    }
  }

  const ledger: PaperLedger = { ...params.ledger, cash, positions, updatedAt: new Date().toISOString() }
  const fill: LedgerFill = {
    at: new Date().toISOString(),
    symbol,
    side: params.side,
    qty,
    price: params.price,
    notionalCad: notional,
    feeCad,
    stopLoss: params.stopLoss,
    takeProfit: params.takeProfit,
    reason: params.reason,
  }
  await savePaperLedger(ledger)
  await (await fillsCol()).insertOne({ ...fill, ledgerId: ledger.id })
  return { ledger, fill }
}

export async function listRecentFills(limit = 20, ledgerId?: string): Promise<LedgerFill[]> {
  const id = ledgerId || bookIdForMode((await loadPaperLedger()).liveMode)
  const rows = await (await fillsCol()).find({ ledgerId: id }).sort({ at: -1 }).limit(limit).toArray()
  return rows.map((r) => ({
    at: String(r.at || ''),
    symbol: String(r.symbol || ''),
    side: r.side === 'SELL' ? 'SELL' : 'BUY',
    qty: Number(r.qty || 0),
    price: Number(r.price || 0),
    notionalCad: Number(r.notionalCad || 0),
    feeCad: Number(r.feeCad || 0),
    stopLoss: Number(r.stopLoss || 0),
    takeProfit: Number(r.takeProfit || 0),
    reason: String(r.reason || ''),
  }))
}

export async function saveCycleLog(doc: Record<string, unknown>): Promise<void> {
  await (await cyclesCol()).insertOne({ ...doc, createdAt: new Date().toISOString() })
}

export async function latestCycleLog(ledgerId?: string): Promise<Record<string, unknown> | null> {
  const id = ledgerId || bookIdForMode((await loadPaperLedger()).liveMode)
  const row = await (await cyclesCol()).find({ ledgerId: id }).sort({ createdAt: -1 }).limit(1).next()
  return row ? (row as Record<string, unknown>) : null
}
