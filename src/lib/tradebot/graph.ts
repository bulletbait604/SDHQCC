import { runDebateAndTrader } from '@/lib/tradebot/agents'
import { isCryptoSymbol, listKrakenCryptoPairs, quoteKrakenMarkets } from '@/lib/tradebot/crypto'
import { sizeBuyQuantity, validateTrade, dayPnlPct } from '@/lib/tradebot/guardrails'
import {
  applyFill,
  loadPaperLedger,
  markToMarket,
  saveCycleLog,
  savePaperLedger,
  type PaperLedger,
} from '@/lib/tradebot/ledger'
import type { CycleDecision, TradeOrderProposal } from '@/lib/tradebot/models'
import { fetchDailyBars } from '@/lib/tradebot/quotes'
import { scanCadBook, type ScanSummary } from '@/lib/tradebot/scanner'
import { getTradebotSettings, isTradebotPaperEnabled } from '@/lib/tradebot/settings'

export type CycleResult = {
  ranAt: string
  paper: true
  region: 'CA'
  currency: 'CAD'
  halted: boolean
  haltReason: string
  equity: number
  cash: number
  dayStartEquity: number
  drawdownPct: number
  dayPnlPct: number
  profitLocked: boolean
  ledger: PaperLedger
  decisions: CycleDecision[]
  scan: ScanSummary
}

function swingLevels(price: number, atr: number, aggressive: boolean) {
  const stopPct = aggressive ? 0.07 : 0.08
  const takePct = aggressive ? 0.22 : 0.18
  const stopFromAtr = (aggressive ? 1.6 : 2.2) * atr
  const takeFromAtr = (aggressive ? 3.8 : 4.5) * atr
  return {
    stopBuy: Number(Math.max(price - Math.max(stopFromAtr, price * stopPct), price * 0.5).toFixed(6)),
    takeBuy: Number((price + Math.max(takeFromAtr, price * takePct)).toFixed(6)),
    stopSell: Number((price + Math.max(stopFromAtr, price * stopPct)).toFixed(6)),
    takeSell: Number(Math.max(price - Math.max(takeFromAtr, price * takePct), 0).toFixed(6)),
  }
}

function trailStop(avgPrice: number, stopLoss: number, price: number): number {
  if (!(price > 0) || !(avgPrice > 0)) return stopLoss
  if (price < avgPrice * 1.06) return stopLoss
  const trail = price * 0.88
  const lock = avgPrice * 1.02
  const next = Math.max(stopLoss, trail, lock)
  return next < price ? Number(next.toFixed(6)) : stopLoss
}

function torontoDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
}

export async function runPaperCycle(): Promise<CycleResult> {
  if (!isTradebotPaperEnabled()) {
    throw new Error('TRADEBOT_PAPER must be true. Live brokers are disabled.')
  }
  const settings = getTradebotSettings()
  let ledger = await loadPaperLedger()

  const { market, scan } = await scanCadBook({
    positions: ledger.positions.map((p) => p.symbol),
  })

  const prices: Record<string, number> = {}
  for (const row of market) prices[row.symbol] = row.quote.price
  for (const pos of ledger.positions) {
    if (!prices[pos.symbol]) {
      try {
        if (isCryptoSymbol(pos.symbol)) {
          const pair = (await listKrakenCryptoPairs()).find((p) => p.symbol === pos.symbol)
          if (!pair) throw new Error('missing crypto pair')
          const [m] = await quoteKrakenMarkets([pair])
          prices[pos.symbol] = m?.quote.price || pos.avgPrice
        } else {
          const { quote } = await fetchDailyBars(pos.symbol)
          prices[pos.symbol] = quote.price
        }
      } catch {
        prices[pos.symbol] = pos.avgPrice
      }
    }
  }

  const equity = markToMarket(ledger, prices)
  const today = torontoDate()
  if (ledger.dayStartDate !== today) {
    ledger.dayStartDate = today
    ledger.dayStartEquity = equity
    ledger.halted = false
    ledger.haltReason = ''
  } else if (!ledger.dayStartEquity) {
    ledger.dayStartEquity = equity
  }

  const drawdownPct =
    ledger.dayStartEquity > 0 ? ((ledger.dayStartEquity - equity) / ledger.dayStartEquity) * 100 : 0
  let livePnl = dayPnlPct(equity, ledger.dayStartEquity)
  if (drawdownPct >= settings.maxDrawdownPct) {
    ledger.halted = true
    ledger.haltReason = `Daily CAD drawdown ${drawdownPct.toFixed(2)}% hit ${settings.maxDrawdownPct}% halt`
    await savePaperLedger(ledger)
  }

  const signals = market.map((m) => m.signal).filter((s): s is NonNullable<(typeof market)[number]['signal']> => Boolean(s))
  const decisions: CycleDecision[] = []

  const maybeExitStops = async () => {
    for (const pos of [...ledger.positions]) {
      const px = prices[pos.symbol]
      if (!(px > 0) || pos.qty <= 0) continue
      const hitStop = pos.stopLoss > 0 && px <= pos.stopLoss
      const hitTp = pos.takeProfit > 0 && px >= pos.takeProfit
      if (!hitStop && !hitTp) continue
      const reason = hitStop ? `Stop-loss ${pos.stopLoss}` : `Take-profit ${pos.takeProfit}`
      const applied = await applyFill({
        ledger,
        side: 'SELL',
        symbol: pos.symbol,
        qty: pos.qty,
        price: px,
        feeBps: isCryptoSymbol(pos.symbol) ? settings.krakenFeeBps : settings.tsxFeeBps,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        reason,
      })
      ledger = applied.ledger
      decisions.push({
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
  }

  if (!ledger.halted) {
    for (const pos of ledger.positions) {
      const px = prices[pos.symbol]
      if (!(px > 0)) continue
      pos.stopLoss = trailStop(pos.avgPrice, pos.stopLoss, px)
      const longerTake = Number((pos.avgPrice * 1.22).toFixed(6))
      if (pos.takeProfit > 0 && pos.takeProfit < longerTake) pos.takeProfit = longerTake
    }
    await maybeExitStops()
  }

  if (!ledger.halted && signals.length) {
    const liveEquityForDesk = markToMarket(ledger, prices)
    livePnl = dayPnlPct(liveEquityForDesk, ledger.dayStartEquity)
    const agent = await runDebateAndTrader(signals, scan.industryTape || [], {
      equity: liveEquityForDesk,
      cash: ledger.cash,
      dayStartEquity: ledger.dayStartEquity,
      dayPnlPct: livePnl,
      startingCad: settings.startingCad,
      targetMinPct: settings.dailyProfitTargetMinPct,
      targetMaxPct: settings.dailyProfitTargetMaxPct,
      openPositions: ledger.positions.map((p) => ({
        symbol: p.symbol,
        qty: p.qty,
        avgPrice: p.avgPrice,
      })),
    })
    const byTicker = new Map(agent.map((d) => [d.ticker, d]))

    for (const signal of signals) {
      const desk = byTicker.get(signal.ticker)
      const pos = ledger.positions.find((p) => p.symbol === signal.ticker)
      let action = desk?.action || 'HOLD'
      if (
        dayPnlPct(markToMarket(ledger, prices), ledger.dayStartEquity) >= settings.dailyProfitTargetMaxPct &&
        action === 'BUY'
      ) {
        action = 'HOLD'
      }
      const aggressive = Boolean(signal.isMeme || signal.highPotential || signal.isNewListing)
      const levels = swingLevels(signal.price, signal.atr, aggressive)
      const stop = action === 'BUY' ? levels.stopBuy : levels.stopSell
      const take = action === 'BUY' ? levels.takeBuy : levels.takeSell

      let quantity = 0
      if (action === 'BUY') {
        quantity = sizeBuyQuantity({
          equity,
          riskPct: settings.riskPct,
          atr: signal.atr,
          atrMultiplier: settings.atrMultiplier,
          price: signal.price,
          maxAssetWeightPct: settings.maxAssetWeightPct,
        })
      } else if (action === 'SELL') {
        quantity = pos?.qty || 0
      }

      const proposal: TradeOrderProposal = {
        ticker: signal.ticker,
        action,
        order_type: 'MARKET',
        quantity,
        limit_price: signal.price,
        stop_loss: stop,
        take_profit: take,
        reasoning_summary: desk?.reasoning_summary || '',
      }

      const liveEquity = markToMarket(ledger, prices)
      const checked = validateTrade(proposal, {
        equity: liveEquity,
        cash: ledger.cash,
        dayStartEquity: ledger.dayStartEquity,
        maxDrawdownPct: settings.maxDrawdownPct,
        maxAssetWeightPct: settings.maxAssetWeightPct,
        dailyProfitLockPct: settings.dailyProfitTargetMaxPct,
        positionQty: pos?.qty || 0,
        positionAvg: pos?.avgPrice || 0,
        lastPrice: signal.price,
      })

      const risk = {
        approved: checked.ok && checked.proposal.action !== 'HOLD',
        risk_score: checked.ok ? 0.2 : 0.9,
        max_portfolio_impact_pct:
          liveEquity > 0 ? ((checked.proposal.quantity * signal.price) / liveEquity) * 100 : 0,
        rejection_reasons: checked.reasons,
        adjusted_proposal: checked.ok ? checked.proposal : null,
      }

      let fill: CycleDecision['fill'] = null
      if (checked.ok && checked.proposal.action !== 'HOLD' && checked.proposal.quantity > 0) {
        const applied = await applyFill({
          ledger,
          side: checked.proposal.action,
          symbol: signal.ticker,
          qty: checked.proposal.quantity,
          price: signal.price,
          feeBps: isCryptoSymbol(signal.ticker) ? settings.krakenFeeBps : settings.tsxFeeBps,
          stopLoss: checked.proposal.stop_loss,
          takeProfit: checked.proposal.take_profit,
          reason: checked.proposal.reasoning_summary,
        })
        ledger = applied.ledger
        fill = {
          filled: true,
          side: checked.proposal.action,
          quantity: applied.fill.qty,
          price: applied.fill.price,
          notionalCad: applied.fill.notionalCad,
          note: `Paper CAD fill · fee CA$${applied.fill.feeCad.toFixed(2)}`,
        }
      } else if (checked.proposal.action === 'HOLD') {
        fill = {
          filled: false,
          side: 'HOLD',
          quantity: 0,
          price: signal.price,
          notionalCad: 0,
          note: 'HOLD — no order',
        }
      } else {
        fill = {
          filled: false,
          side: checked.proposal.action,
          quantity: 0,
          price: signal.price,
          notionalCad: 0,
          note: checked.reasons.join('; ') || 'Blocked by guardrails',
        }
      }

      decisions.push({
        ticker: signal.ticker,
        signal: signal.technical_signal,
        price: signal.price,
        proposal: checked.proposal,
        risk,
        fill,
      })
    }
  }

  const finalEquity = markToMarket(ledger, prices)
  const finalPnl = dayPnlPct(finalEquity, ledger.dayStartEquity)
  await savePaperLedger(ledger)
  const result: CycleResult = {
    ranAt: new Date().toISOString(),
    paper: true,
    region: 'CA',
    currency: 'CAD',
    halted: ledger.halted,
    haltReason: ledger.haltReason,
    equity: Number(finalEquity.toFixed(2)),
    cash: Number(ledger.cash.toFixed(2)),
    dayStartEquity: Number(ledger.dayStartEquity.toFixed(2)),
    drawdownPct: Number(drawdownPct.toFixed(2)),
    dayPnlPct: Number(finalPnl.toFixed(2)),
    profitLocked: finalPnl >= settings.dailyProfitTargetMaxPct,
    ledger,
    decisions,
    scan,
  }
  await saveCycleLog({ ledgerId: 'cad-paper', ...result })
  return result
}
