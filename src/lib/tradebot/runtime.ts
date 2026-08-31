import { isCryptoSymbol } from '@/lib/tradebot/crypto'
import { applyFill, type PaperLedger } from '@/lib/tradebot/ledger'
import type { CycleDecision } from '@/lib/tradebot/models'
import { getTradebotSettings } from '@/lib/tradebot/settings'

export function swingLevels(price: number, atr: number, aggressive: boolean) {
  const stopPct = aggressive ? 0.07 : 0.08
  const takePct = 2.0
  const stopFromAtr = (aggressive ? 1.6 : 2.2) * atr
  const takeFromAtr = (aggressive ? 3.8 : 4.5) * atr
  return {
    stopBuy: Number(Math.max(price - Math.max(stopFromAtr, price * stopPct), price * 0.5).toFixed(6)),
    takeBuy: Number((price + Math.max(takeFromAtr, price * takePct)).toFixed(6)),
    stopSell: Number((price + Math.max(stopFromAtr, price * stopPct)).toFixed(6)),
    takeSell: Number(Math.max(price - Math.max(takeFromAtr, price * takePct), 0).toFixed(6)),
  }
}

export function trailStop(avgPrice: number, stopLoss: number, price: number): number {
  if (!(price > 0) || !(avgPrice > 0)) return stopLoss
  if (price < avgPrice * 1.06) return stopLoss
  const trail = price * 0.88
  const lock = avgPrice * 1.02
  const next = Math.max(stopLoss, trail, lock)
  return next < price ? Number(next.toFixed(6)) : stopLoss
}

export function torontoDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
}

export function rollTorontoDay(ledger: PaperLedger, equity: number): PaperLedger {
  const today = torontoDate()
  if (ledger.dayStartDate !== today) {
    ledger.dayStartDate = today
    ledger.dayStartEquity = equity
    ledger.halted = false
    ledger.haltReason = ''
  } else if (!ledger.dayStartEquity) {
    ledger.dayStartEquity = equity
  }
  return ledger
}

export function trailAndLiftTakes(ledger: PaperLedger, prices: Record<string, number>): void {
  for (const pos of ledger.positions) {
    const px = prices[pos.symbol]
    if (!(px > 0)) continue
    pos.stopLoss = trailStop(pos.avgPrice, pos.stopLoss, px)
    const longerTake = Number((pos.avgPrice * 3).toFixed(6))
    if (pos.takeProfit > 0 && pos.takeProfit < longerTake) pos.takeProfit = longerTake
  }
}

export async function executeHardExits(
  ledger: PaperLedger,
  prices: Record<string, number>,
  decisions: CycleDecision[]
): Promise<{ ledger: PaperLedger; decisions: CycleDecision[] }> {
  const settings = getTradebotSettings()
  let next = ledger
  const out = [...decisions]
  for (const pos of [...next.positions]) {
    const px = prices[pos.symbol]
    if (!(px > 0) || pos.qty <= 0) continue
    const hitStop = pos.stopLoss > 0 && px <= pos.stopLoss
    const hitTp = pos.takeProfit > 0 && px >= pos.takeProfit
    if (!hitStop && !hitTp) continue
    const reason = hitStop ? `Stop-loss ${pos.stopLoss}` : `Take-profit ${pos.takeProfit}`
    const applied = await applyFill({
      ledger: next,
      side: 'SELL',
      symbol: pos.symbol,
      qty: pos.qty,
      price: px,
      feeBps: isCryptoSymbol(pos.symbol) ? settings.krakenFeeBps : settings.tsxFeeBps,
      stopLoss: pos.stopLoss,
      takeProfit: pos.takeProfit,
      reason,
    })
    next = applied.ledger
    out.push({
      ticker: pos.symbol,
      signal: hitStop ? 'BEARISH' : 'BULLISH',
      price: px,
      proposal: {
        ticker: pos.symbol,
        action: 'SELL',
        order_type: 'MARKET',
        quantity: applied.fill.qty,
        limit_price: px,
        stop_loss: pos.stopLoss,
        take_profit: pos.takeProfit,
        reasoning_summary: reason,
      },
      risk: {
        approved: true,
        risk_score: 0.1,
        max_portfolio_impact_pct: 0,
        rejection_reasons: [],
        adjusted_proposal: null,
      },
      fill: {
        filled: true,
        side: 'SELL',
        quantity: applied.fill.qty,
        price: applied.fill.price,
        notionalCad: applied.fill.notionalCad,
        note: `Hard exit · ${reason}`,
      },
    })
  }
  return { ledger: next, decisions: out }
}
