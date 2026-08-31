import type { TradeOrderProposal } from '@/lib/tradebot/models'

export type GuardrailContext = {
  equity: number
  cash: number
  dayStartEquity: number
  maxDrawdownPct: number
  maxAssetWeightPct: number
  dailyProfitLockPct: number
  positionQty: number
  positionAvg: number
  lastPrice: number
}

export type GuardrailResult = {
  ok: boolean
  reasons: string[]
  proposal: TradeOrderProposal
}

export function dayPnlPct(equity: number, dayStartEquity: number): number {
  if (!(dayStartEquity > 0)) return 0
  return ((equity - dayStartEquity) / dayStartEquity) * 100
}

function roundQty(n: number): number {
  if (!(n > 0)) return 0
  if (n >= 1) return Math.floor(n * 1000) / 1000
  return Math.floor(n * 1e8) / 1e8
}

export function sizeBuyQuantity(params: {
  equity: number
  riskPct: number
  atr: number
  atrMultiplier: number
  price: number
  maxAssetWeightPct: number
}): number {
  const riskCad = params.equity * (params.riskPct / 100)
  const stopDistance = Math.max(params.atr * params.atrMultiplier, params.price * 0.008)
  const fromRisk = stopDistance > 0 ? riskCad / stopDistance : 0
  const maxCad = params.equity * (params.maxAssetWeightPct / 100)
  const fromCap = params.price > 0 ? maxCad / params.price : 0
  return roundQty(Math.min(fromRisk, fromCap))
}

export function quantityRespectingMinLot(params: {
  qty: number
  minLot: number
  price: number
  cash: number
  maxNotional: number
}): number {
  const qty = Math.max(0, params.qty)
  if (!(params.price > 0)) return 0
  if (qty >= params.minLot) return qty
  if (!(params.minLot > 0)) return qty
  const cost = params.minLot * params.price
  if (cost > params.cash + 0.01) return 0
  if (cost > params.maxNotional + 0.01) return 0
  return params.minLot
}

export function validateTrade(
  proposal: TradeOrderProposal,
  ctx: GuardrailContext
): GuardrailResult {
  const reasons: string[] = []
  const p = { ...proposal }
  p.quantity = roundQty(p.quantity)
  p.ticker = p.ticker.trim().toUpperCase()

  if (!p.ticker) reasons.push('Missing ticker')
  if (p.action !== 'BUY' && p.action !== 'SELL' && p.action !== 'HOLD') {
    reasons.push('Invalid action')
  }

  if (p.action === 'HOLD') {
    return { ok: reasons.length === 0, reasons, proposal: { ...p, quantity: 0 } }
  }

  if (!(p.stop_loss > 0)) reasons.push('Stop-loss is required')
  if (!(p.take_profit > 0)) reasons.push('Take-profit is required')
  if (!(p.quantity > 0)) reasons.push('Quantity must be positive')

  const price = ctx.lastPrice
  if (!(price > 0)) reasons.push('No last price')

  const dayDd =
    ctx.dayStartEquity > 0 ? ((ctx.dayStartEquity - ctx.equity) / ctx.dayStartEquity) * 100 : 0
  if (dayDd >= ctx.maxDrawdownPct) {
    reasons.push(`Daily drawdown halt (${dayDd.toFixed(2)}% >= ${ctx.maxDrawdownPct}%)`)
  }

  const pnl = dayPnlPct(ctx.equity, ctx.dayStartEquity)
  if (p.action === 'BUY' && ctx.dailyProfitLockPct > 0 && pnl >= ctx.dailyProfitLockPct) {
    reasons.push(
      `Daily profit lock (+${pnl.toFixed(2)}% hit ${ctx.dailyProfitLockPct}% target — no new buys)`
    )
  }

  if (p.action === 'BUY') {
    if (p.stop_loss >= price) reasons.push('Buy stop-loss must be below price')
    if (p.take_profit <= price) reasons.push('Buy take-profit must be above price')
    const nextQty = ctx.positionQty + p.quantity
    const nextNotional = nextQty * price
    const weight = ctx.equity > 0 ? (nextNotional / ctx.equity) * 100 : 100
    if (weight > ctx.maxAssetWeightPct + 0.01) {
      reasons.push(`Position would be ${weight.toFixed(1)}% of book (max ${ctx.maxAssetWeightPct}%)`)
    }
    const cost = p.quantity * price
    if (cost > ctx.cash) reasons.push('Insufficient CAD cash')
  }

  if (p.action === 'SELL') {
    if (ctx.positionQty <= 0) reasons.push('No long position to sell')
    if (p.quantity > ctx.positionQty + 1e-9) {
      p.quantity = roundQty(ctx.positionQty)
    }
  }

  return { ok: reasons.length === 0, reasons, proposal: p }
}
