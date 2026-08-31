import { listKrakenCryptoPairs, quoteKrakenMarkets, type CryptoMarket } from '@/lib/tradebot/crypto'
import { sizeBuyQuantity, validateTrade, dayPnlPct } from '@/lib/tradebot/guardrails'
import {
  applyFill,
  latestCycleLog,
  listRecentFills,
  loadPaperLedger,
  markToMarket,
  savePaperLedger,
} from '@/lib/tradebot/ledger'
import type { CycleDecision, TradeOrderProposal } from '@/lib/tradebot/models'
import { isMemeTicker } from '@/lib/tradebot/opportunity'
import { rankLiveBuys } from '@/lib/tradebot/liveTapeRank'
import { executeHardExits, rollTorontoDay, swingLevels, trailAndLiftTakes } from '@/lib/tradebot/runtime'
import { getTradebotSettings, isTradebotPaperEnabled } from '@/lib/tradebot/settings'

export { rankLiveBuys } from '@/lib/tradebot/liveTapeRank'

export type LiveMark = {
  symbol: string
  price: number
  dayChangePct: number
}

export type TickResult = {
  ranAt: string
  paper: true
  live: true
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
  ledger: Awaited<ReturnType<typeof loadPaperLedger>>
  decisions: CycleDecision[]
  fills: Awaited<ReturnType<typeof listRecentFills>>
  marks: LiveMark[]
  tickSeconds: number
}

async function quoteWatch(symbols: string[]): Promise<CryptoMarket[]> {
  const want = new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))
  if (!want.size) return []
  const pairs = (await listKrakenCryptoPairs()).filter((p) => want.has(p.symbol))
  if (!pairs.length) return []
  return quoteKrakenMarkets(pairs)
}

function filledBuy(
  ticker: string,
  price: number,
  proposal: TradeOrderProposal,
  qty: number,
  fillPrice: number,
  notionalCad: number,
  note: string
): CycleDecision {
  return {
    ticker,
    signal: 'BULLISH',
    price,
    proposal,
    risk: {
      approved: true,
      risk_score: 0.2,
      max_portfolio_impact_pct: 0,
      rejection_reasons: [],
      adjusted_proposal: proposal,
    },
    fill: {
      filled: true,
      side: 'BUY',
      quantity: qty,
      price: fillPrice,
      notionalCad,
      note,
    },
  }
}

export async function runPaperTick(): Promise<TickResult> {
  if (!isTradebotPaperEnabled()) {
    throw new Error('TRADEBOT_PAPER must be true. Live brokers are disabled.')
  }
  const settings = getTradebotSettings()
  let ledger = await loadPaperLedger()
  if (!ledger.engineOn) {
    return {
      ranAt: new Date().toISOString(),
      paper: true,
      live: true,
      region: 'CA',
      currency: 'CAD',
      halted: ledger.halted,
      haltReason: ledger.haltReason,
      equity: Number(markToMarket(ledger, {}).toFixed(2)),
      cash: Number(ledger.cash.toFixed(2)),
      dayStartEquity: Number(ledger.dayStartEquity.toFixed(2)),
      drawdownPct: 0,
      dayPnlPct: 0,
      profitLocked: false,
      ledger,
      decisions: [],
      fills: await listRecentFills(12),
      marks: [],
      tickSeconds: settings.tickSeconds,
    }
  }
  const lastCycle = await latestCycleLog()
  const scan = lastCycle?.scan as { shortlist?: string[] } | undefined
  const shortlist = Array.isArray(scan?.shortlist) ? scan.shortlist : []
  const symbols = Array.from(
    new Set([...ledger.positions.map((p) => p.symbol), ...settings.watchlist, ...shortlist])
  ).slice(0, 24)

  const markets = await quoteWatch(symbols)
  const prices: Record<string, number> = {}
  for (const m of markets) prices[m.pair.symbol] = m.quote.price
  for (const pos of ledger.positions) {
    if (!(prices[pos.symbol] > 0)) prices[pos.symbol] = pos.avgPrice
  }

  let equity = markToMarket(ledger, prices)
  ledger = rollTorontoDay(ledger, equity)
  equity = markToMarket(ledger, prices)
  const drawdownPct =
    ledger.dayStartEquity > 0 ? ((ledger.dayStartEquity - equity) / ledger.dayStartEquity) * 100 : 0
  if (drawdownPct >= settings.maxDrawdownPct) {
    ledger.halted = true
    ledger.haltReason = `Daily CAD drawdown ${drawdownPct.toFixed(2)}% hit ${settings.maxDrawdownPct}% halt`
  }

  let decisions: CycleDecision[] = []
  if (!ledger.halted) {
    trailAndLiftTakes(ledger, prices)
    const exited = await executeHardExits(ledger, prices, decisions)
    ledger = exited.ledger
    decisions = exited.decisions
  }

  const liveEquity = markToMarket(ledger, prices)
  const livePnl = dayPnlPct(liveEquity, ledger.dayStartEquity)
  const held = new Set(ledger.positions.map((p) => p.symbol))
  const canBuy =
    !ledger.halted &&
    livePnl < settings.dailyProfitTargetMaxPct &&
    ledger.positions.length < settings.maxOpenPositions &&
    ledger.cash >= 5

  if (canBuy) {
    const ranked = rankLiveBuys(
      markets.map((m) => ({
        symbol: m.pair.symbol,
        dayChangePct: m.dayChangePct,
        volume24h: m.volume24h,
      })),
      held
    )
    const pick = ranked[0]
    const market = pick ? markets.find((m) => m.pair.symbol === pick.symbol) : undefined
    if (market && pick) {
      const price = market.quote.price
      const aggressive = isMemeTicker(pick.symbol)
      const atr = Math.max(price * 0.04, 0.000001)
      const levels = swingLevels(price, atr, aggressive)
      const quantity = sizeBuyQuantity({
        equity: liveEquity,
        riskPct: settings.riskPct,
        atr,
        atrMultiplier: settings.atrMultiplier,
        price,
        maxAssetWeightPct: settings.maxAssetWeightPct,
      })
      const proposal: TradeOrderProposal = {
        ticker: pick.symbol,
        action: 'BUY',
        order_type: 'MARKET',
        quantity,
        limit_price: price,
        stop_loss: levels.stopBuy,
        take_profit: levels.takeBuy,
        reasoning_summary: `Live tape +${pick.dayChangePct.toFixed(1)}% today`,
      }
      const checked = validateTrade(proposal, {
        equity: liveEquity,
        cash: ledger.cash,
        dayStartEquity: ledger.dayStartEquity,
        maxDrawdownPct: settings.maxDrawdownPct,
        maxAssetWeightPct: settings.maxAssetWeightPct,
        dailyProfitLockPct: settings.dailyProfitTargetMaxPct,
        positionQty: 0,
        positionAvg: 0,
        lastPrice: price,
      })
      if (checked.ok && checked.proposal.quantity > 0) {
        const applied = await applyFill({
          ledger,
          side: 'BUY',
          symbol: pick.symbol,
          qty: checked.proposal.quantity,
          price,
          feeBps: settings.krakenFeeBps,
          stopLoss: checked.proposal.stop_loss,
          takeProfit: checked.proposal.take_profit,
          reason: checked.proposal.reasoning_summary,
        })
        ledger = applied.ledger
        decisions.push(
          filledBuy(
            pick.symbol,
            price,
            checked.proposal,
            applied.fill.qty,
            applied.fill.price,
            applied.fill.notionalCad,
            `Paper CAD fill · fee CA$${applied.fill.feeCad.toFixed(2)}`
          )
        )
      }
    }
  }

  const finalEquity = markToMarket(ledger, prices)
  const finalPnl = dayPnlPct(finalEquity, ledger.dayStartEquity)
  await savePaperLedger(ledger)
  const fills = await listRecentFills(12)
  return {
    ranAt: new Date().toISOString(),
    paper: true,
    live: true,
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
    fills,
    marks: markets.map((m) => ({
      symbol: m.pair.symbol,
      price: Number(m.quote.price.toFixed(6)),
      dayChangePct: Number(m.dayChangePct.toFixed(2)),
    })),
    tickSeconds: settings.tickSeconds,
  }
}
