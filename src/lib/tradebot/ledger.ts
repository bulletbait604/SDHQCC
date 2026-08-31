import clientPromise from '@/lib/mongodb'
import { TRADEBOT_BASE_CURRENCY } from '@/lib/tradebot/canada'
import { getTradebotSettings, isKrakenLiveAllowed } from '@/lib/tradebot/settings'
import { parseVolatility, type VolatilityLevel } from '@/lib/tradebot/volatility'

export type PaperPosition = {
  symbol: string
  qty: number
  avgPrice: number
  stopLoss: number
  takeProfit: number
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
  engineOn: boolean
  liveMode: boolean
  volatility: VolatilityLevel
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

const LEDGER_ID = 'cad-paper'
const LEDGER_COL = 'tradebotLedger'
const FILLS_COL = 'tradebotFills'
const CYCLES_COL = 'tradebotCycles'

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

function mapLedger(r: Record<string, unknown>, startingCad: number): PaperLedger {
  const positionsRaw = Array.isArray(r.positions) ? r.positions : []
  return {
    id: LEDGER_ID,
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
    updatedAt: String(r.updatedAt || new Date().toISOString()),
  }
}

export function markToMarket(ledger: PaperLedger, prices: Record<string, number>): number {
  const pos = ledger.positions.reduce((sum, p) => sum + p.qty * (prices[p.symbol] || p.avgPrice), 0)
  return ledger.cash + pos
}

function freshLedger(startingCad: number, dayStartDate: string): PaperLedger {
  return {
    id: LEDGER_ID,
    currency: 'CAD',
    cash: startingCad,
    startingEquity: startingCad,
    dayStartEquity: startingCad,
    dayStartDate,
    halted: false,
    haltReason: '',
    engineOn: false,
    liveMode: false,
    volatility: 'medium',
    positions: [],
    updatedAt: new Date().toISOString(),
  }
}

export async function loadPaperLedger(): Promise<PaperLedger> {
  const { startingCad } = getTradebotSettings()
  const col = await ledgerCol()
  const existing = await col.findOne({ id: LEDGER_ID })
  const today = torontoDate()
  if (!existing) {
    const fresh = freshLedger(startingCad, today)
    await col.insertOne({ ...fresh })
    return fresh
  }
  const ledger = mapLedger(existing as Record<string, unknown>, startingCad)
  if (ledger.startingEquity !== startingCad) {
    const reset = freshLedger(startingCad, today)
    reset.engineOn = ledger.engineOn
    reset.liveMode = ledger.liveMode
    reset.volatility = ledger.volatility
    await col.replaceOne({ id: LEDGER_ID }, reset, { upsert: true })
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

export async function savePaperLedger(ledger: PaperLedger): Promise<void> {
  ledger.updatedAt = new Date().toISOString()
  await (await ledgerCol()).updateOne({ id: LEDGER_ID }, { $set: ledger }, { upsert: true })
}

export async function setPaperEngine(on: boolean): Promise<PaperLedger> {
  return setDeskControls({ on })
}

export async function setDeskControls(patch: {
  on?: boolean
  liveMode?: boolean
  volatility?: VolatilityLevel
}): Promise<PaperLedger> {
  const ledger = await loadPaperLedger()
  if (typeof patch.on === 'boolean') ledger.engineOn = Boolean(patch.on)
  if (typeof patch.liveMode === 'boolean') {
    if (patch.liveMode && !isKrakenLiveAllowed()) {
      throw new Error('Set TRADEBOT_LIVE=true and Kraken API keys before switching to Real money.')
    }
    ledger.liveMode = Boolean(patch.liveMode)
    if (patch.liveMode) ledger.engineOn = false
  }
  if (patch.volatility) ledger.volatility = parseVolatility(patch.volatility)
  await savePaperLedger(ledger)
  return ledger
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
  await (await fillsCol()).insertOne({ ...fill, ledgerId: LEDGER_ID })
  return { ledger, fill }
}

export async function listRecentFills(limit = 20): Promise<LedgerFill[]> {
  const rows = await (await fillsCol()).find({ ledgerId: LEDGER_ID }).sort({ at: -1 }).limit(limit).toArray()
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

export async function latestCycleLog(): Promise<Record<string, unknown> | null> {
  const row = await (await cyclesCol()).find({ ledgerId: LEDGER_ID }).sort({ createdAt: -1 }).limit(1).next()
  return row ? (row as Record<string, unknown>) : null
}
