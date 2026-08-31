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
import { executeHardExits, rollTorontoDay, swingLevels, trailAndLiftTakes } from '@/lib/tradebot/runtime'
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

export async function runPaperCycle(): Promise<CycleResult> {
  if (!isTradebotPaperEnabled()) {
    throw new Error('TRADEBOT_PAPER must be true. Live brokers are disabled.')
  }
  const settings = getTradebotSettings()
  let ledger = await loadPaperLedger()
  if (!ledger.engineOn) {
    throw new Error('TradeBot is OFF. Turn it ON to run.')
  }

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
  ledger = rollTorontoDay(ledger, equity)

  const drawdownPct =
    ledger.dayStartEquity > 0 ? ((ledger.dayStartEquity - equity) / ledger.dayStartEquity) * 100 : 0
  let livePnl = dayPnlPct(equity, ledger.dayStartEquity)
  if (drawdownPct >= settings.maxDrawdownPct) {
    ledger.halted = true
    ledger.haltReason = `Daily CAD drawdown ${drawdownPct.toFixed(2)}% hit ${settings.maxDrawdownPct}% halt`
    await savePaperLedger(ledger)
  }

  const signals = market.map((m) => m.signal).filter((s): s is NonNullable<(typeof market)[number]['signal']> => Boolean(s))
  let decisions: CycleDecision[] = []

  if (!ledger.halted) {
    trailAndLiftTakes(ledger, prices)
    const exited = await executeHardExits(ledger, prices, decisions)
    ledger = exited.ledger
    decisions = exited.decisions
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
