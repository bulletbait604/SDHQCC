import type { CryptoPair } from '@/lib/tradebot/crypto'
import type { PaperLedger } from '@/lib/tradebot/ledger'
import type { CycleDecision } from '@/lib/tradebot/models'
import { getTradebotSettings } from '@/lib/tradebot/settings'
import { trailStops } from '@/lib/tradebot/trail'
import { placeManagedFill } from '@/lib/tradebot/venue'

export { trailStops } from '@/lib/tradebot/trail'

export function swingLevels(price: number, pct?: { stopPct: number; takePct: number }) {
  const settings = getTradebotSettings()
  const stopPct = pct?.stopPct ?? settings.stopPct
  const takePct = pct?.takePct ?? settings.takePct
  return {
    stopBuy: Number((price * (1 - stopPct)).toFixed(6)),
    takeBuy: Number((price * (1 + takePct)).toFixed(6)),
    stopSell: Number((price * (1 + stopPct)).toFixed(6)),
    takeSell: Number((price * (1 - takePct)).toFixed(6)),
  }
}

export function pinStopsTakes(ledger: PaperLedger, pct?: { stopPct: number; takePct: number }): void {
  const settings = getTradebotSettings()
  const stopPct = pct?.stopPct ?? settings.stopPct
  const takePct = pct?.takePct ?? settings.takePct
  for (const pos of ledger.positions) {
    if (!(pos.avgPrice > 0)) continue
    if (!(pos.stopLoss > 0)) pos.stopLoss = Number((pos.avgPrice * (1 - stopPct)).toFixed(6))
    if (!(pos.takeProfit > 0)) pos.takeProfit = Number((pos.avgPrice * (1 + takePct)).toFixed(6))
  }
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

export async function executeHardExits(
  ledger: PaperLedger,
  prices: Record<string, number>,
  decisions: CycleDecision[],
  pairsBySymbol: Map<string, CryptoPair> = new Map()
): Promise<{ ledger: PaperLedger; decisions: CycleDecision[] }> {
  let next = ledger
  const out = [...decisions]
  for (const pos of [...next.positions]) {
    const px = prices[pos.symbol]
    if (!(px > 0) || pos.qty <= 0) continue
    const hitStop = pos.stopLoss > 0 && px <= pos.stopLoss
    const hitTp = pos.takeProfit > 0 && px >= pos.takeProfit
    if (!hitStop && !hitTp) continue
    const nativeKind = hitStop ? 'stop' : 'take'
    const resting = (next.openOrders || []).some(
      (o) => o.symbol === pos.symbol && o.kind === nativeKind && o.side === 'SELL'
    )
    if (resting) continue
    const reason = hitStop ? `Stop-loss ${pos.stopLoss}` : `Take-profit ${pos.takeProfit}`
    let applied: Awaited<ReturnType<typeof placeManagedFill>>
    try {
      applied = await placeManagedFill({
        ledger: next,
        side: 'SELL',
        symbol: pos.symbol,
        qty: pos.qty,
        price: px,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        reason,
        pair: pairsBySymbol.get(pos.symbol),
        execution: hitStop ? 'market' : 'limit',
      })
    } catch (err) {
      console.error('[tradebot] hard exit', pos.symbol, err)
      continue
    }
    next = applied.ledger
    if (!applied.fill) continue
    out.push({
      ticker: pos.symbol,
      signal: hitStop ? 'BEARISH' : 'BULLISH',
      price: px,
      proposal: {
        ticker: pos.symbol,
        action: 'SELL',
        order_type: hitStop ? 'MARKET' : 'LIMIT',
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
        note: `${applied.venue === 'kraken' ? 'Kraken' : 'Practice'} exit · ${reason}`,
      },
    })
  }
  return { ledger: next, decisions: out }
}
