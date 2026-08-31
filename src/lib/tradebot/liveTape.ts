import {
  fetchKrakenOhlc,
  listLiquidKrakenPairs,
  quoteKrakenMarkets,
  usdCadRate,
  type CryptoMarket,
  type CryptoPair,
} from '@/lib/tradebot/crypto'
import { sizeBuyQuantity, validateTrade, dayPnlPct } from '@/lib/tradebot/guardrails'
import { ema, macdHistogram, rsi } from '@/lib/tradebot/indicators'
import {
  listRecentFills,
  loadPaperLedger,
  markToMarket,
  savePaperLedger,
} from '@/lib/tradebot/ledger'
import type { CycleDecision, TradeOrderProposal } from '@/lib/tradebot/models'
import { liveBuyOk, liveEntryScore, liveSellFade, rankLiveBuys } from '@/lib/tradebot/liveTapeRank'
import { executeHardExits, pinStopsTakes, rollTorontoDay, swingLevels } from '@/lib/tradebot/runtime'
import { getTradebotSettings, isPlacingLiveOrders, isTradebotDeskEnabled } from '@/lib/tradebot/settings'
import { parseVolatility, volatilityProfile } from '@/lib/tradebot/volatility'
import { placeManagedFill, syncLiveCash } from '@/lib/tradebot/venue'

export { rankLiveBuys } from '@/lib/tradebot/liveTapeRank'

export type LiveMark = {
  symbol: string
  price: number
  dayChangePct: number
}

export type TickResult = {
  ranAt: string
  paper: boolean
  live: boolean
  krakenLive: boolean
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
  engineOn: boolean
}

let ohlcCache: { at: number; closes: Record<string, number[]> } | null = null

async function loadCloses(pairs: CryptoPair[]): Promise<Record<string, number[]>> {
  if (ohlcCache && Date.now() - ohlcCache.at < 90_000) return ohlcCache.closes
  const fx = pairs.some((p) => !p.nativeCad) ? await usdCadRate().catch(() => 1) : 1
  const closes: Record<string, number[]> = {}
  for (const pair of pairs) {
    try {
      const { bars } = await fetchKrakenOhlc(pair, fx, 15)
      closes[pair.symbol] = bars.map((b) => b.c)
    } catch {
      /* skip pair */
    }
  }
  ohlcCache = { at: Date.now(), closes }
  return closes
}

function filledRow(
  ticker: string,
  price: number,
  proposal: TradeOrderProposal,
  qty: number,
  fillPrice: number,
  notionalCad: number,
  note: string,
  signal: 'BULLISH' | 'BEARISH'
): CycleDecision {
  return {
    ticker,
    signal,
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
      side: proposal.action,
      quantity: qty,
      price: fillPrice,
      notionalCad,
      note,
    },
  }
}

export async function runPaperTick(): Promise<TickResult> {
  if (!isTradebotDeskEnabled()) {
    throw new Error('Set TRADEBOT_PAPER=true for fake money, or TRADEBOT_LIVE=true with Kraken keys.')
  }
  const settings = getTradebotSettings()
  let ledger = await loadPaperLedger()
  const vol = volatilityProfile(parseVolatility(ledger.volatility))
  const pairs = await listLiquidKrakenPairs(vol.level)
  const markets: CryptoMarket[] = pairs.length ? await quoteKrakenMarkets(pairs) : []
  const pairsBySymbol = new Map(pairs.map((p) => [p.symbol, p]))
  const prices: Record<string, number> = {}
  for (const m of markets) prices[m.pair.symbol] = m.quote.price
  for (const pos of ledger.positions) {
    if (!(prices[pos.symbol] > 0)) prices[pos.symbol] = pos.avgPrice
  }

  const marks: LiveMark[] = markets.map((m) => ({
    symbol: m.pair.symbol,
    price: Number(m.quote.price.toFixed(6)),
    dayChangePct: Number(m.dayChangePct.toFixed(2)),
  }))

  const placingLive = isPlacingLiveOrders(ledger)

  if (!ledger.engineOn) {
    if (placingLive) {
      ledger = await syncLiveCash(ledger)
      await savePaperLedger(ledger)
    }
    return {
      ranAt: new Date().toISOString(),
      paper: !placingLive,
      live: true,
      krakenLive: placingLive,
      region: 'CA',
      currency: 'CAD',
      halted: ledger.halted,
      haltReason: ledger.haltReason,
      equity: Number(markToMarket(ledger, prices).toFixed(2)),
      cash: Number(ledger.cash.toFixed(2)),
      dayStartEquity: Number((ledger.dayStartEquity || settings.startingCad).toFixed(2)),
      drawdownPct: 0,
      dayPnlPct: Number(dayPnlPct(markToMarket(ledger, prices), ledger.dayStartEquity || settings.startingCad).toFixed(2)),
      profitLocked: false,
      ledger,
      decisions: [],
      fills: await listRecentFills(12),
      marks,
      tickSeconds: settings.tickSeconds,
      engineOn: false,
    }
  }

  ledger = await syncLiveCash(ledger)
  let equity = markToMarket(ledger, prices)
  ledger = rollTorontoDay(ledger, equity)
  pinStopsTakes(ledger)
  equity = markToMarket(ledger, prices)
  const drawdownPct =
    ledger.dayStartEquity > 0 ? ((ledger.dayStartEquity - equity) / ledger.dayStartEquity) * 100 : 0
  if (drawdownPct >= settings.maxDrawdownPct) {
    ledger.halted = true
    ledger.haltReason = `Daily CAD drawdown ${drawdownPct.toFixed(2)}% hit ${settings.maxDrawdownPct}% halt`
  }

  let decisions: CycleDecision[] = []
  if (!ledger.halted) {
    const exited = await executeHardExits(ledger, prices, decisions, pairsBySymbol)
    ledger = exited.ledger
    decisions = exited.decisions
  }

  const closes = await loadCloses(pairs)
  const liveEquity = markToMarket(ledger, prices)
  const livePnl = dayPnlPct(liveEquity, ledger.dayStartEquity)

  if (!ledger.halted) {
    for (const pos of [...ledger.positions]) {
      const series = closes[pos.symbol] || []
      const fade = liveSellFade({
        rsi: rsi(series) ?? 50,
        ema9: ema(series, 9),
        ema21: ema(series, 21),
      })
      const px = prices[pos.symbol]
      if (!fade || !(px > 0)) continue
      const reason = 'Momentum slowed (short average dropped under the long one).'
      let applied: Awaited<ReturnType<typeof placeManagedFill>>
      try {
        applied = await placeManagedFill({
          ledger,
          side: 'SELL',
          symbol: pos.symbol,
          qty: pos.qty,
          price: px,
          stopLoss: pos.stopLoss,
          takeProfit: pos.takeProfit,
          reason,
          pair: pairsBySymbol.get(pos.symbol),
        })
      } catch (err) {
        console.error('[tradebot] fade sell', pos.symbol, err)
        continue
      }
      ledger = applied.ledger
      const levels = swingLevels(px)
      decisions.push(
        filledRow(
          pos.symbol,
          px,
          {
            ticker: pos.symbol,
            action: 'SELL',
            order_type: 'MARKET',
            quantity: applied.fill.qty,
            limit_price: px,
            stop_loss: levels.stopBuy,
            take_profit: levels.takeBuy,
            reasoning_summary: reason,
          },
          applied.fill.qty,
          applied.fill.price,
          applied.fill.notionalCad,
          applied.venue === 'kraken' ? 'Sold on Kraken' : 'Sold (practice)',
          'BEARISH'
        )
      )
    }
  }

  const held = new Set(ledger.positions.map((p) => p.symbol))
  const canBuy =
    !ledger.halted &&
    livePnl < settings.dailyProfitTargetMaxPct &&
    ledger.positions.length < vol.maxOpen &&
    ledger.cash >= 5

  if (canBuy) {
    const scored = markets.map((m) => {
      const series = closes[m.pair.symbol] || []
      const ok = liveBuyOk({
        rsi: rsi(series) ?? 52,
        ema9: ema(series, 9),
        ema21: ema(series, 21),
        macd: macdHistogram(series) ?? 0,
        dayChangePct: m.dayChangePct,
        volatility: vol.level,
      })
      return {
        symbol: m.pair.symbol,
        dayChangePct: m.dayChangePct,
        volume24h: m.volume24h,
        score: ok ? liveEntryScore({ symbol: m.pair.symbol, dayChangePct: m.dayChangePct, volume24h: m.volume24h }, vol.level) : 0,
      }
    })
    const pick = rankLiveBuys(scored, held)[0]
    const market = pick ? markets.find((m) => m.pair.symbol === pick.symbol) : undefined
    if (market && pick) {
      const price = market.quote.price
      const levels = swingLevels(price, { stopPct: vol.stopPct, takePct: vol.takePct })
      const atr = Math.max(price * vol.stopPct, 0.000001)
      const quantity = sizeBuyQuantity({
        equity: liveEquity,
        riskPct: settings.riskPct,
        atr,
        atrMultiplier: 1,
        price,
        maxAssetWeightPct: vol.maxAssetWeightPct,
      })
      const reason =
        vol.level === 'high'
          ? `High vol: ${pick.symbol.replace(/-CAD$/, '')} is up ${pick.dayChangePct.toFixed(1)}% — chasing a faster move.`
          : vol.level === 'low'
            ? `Low vol: ${pick.symbol.replace(/-CAD$/, '')} is up ${pick.dayChangePct.toFixed(1)}% among calmer coins.`
            : `Up ${pick.dayChangePct.toFixed(1)}% and the short average is above the long one.`
      const proposal: TradeOrderProposal = {
        ticker: pick.symbol,
        action: 'BUY',
        order_type: 'MARKET',
        quantity,
        limit_price: price,
        stop_loss: levels.stopBuy,
        take_profit: levels.takeBuy,
        reasoning_summary: reason,
      }
      const checked = validateTrade(proposal, {
        equity: liveEquity,
        cash: ledger.cash,
        dayStartEquity: ledger.dayStartEquity,
        maxDrawdownPct: settings.maxDrawdownPct,
        maxAssetWeightPct: vol.maxAssetWeightPct,
        dailyProfitLockPct: settings.dailyProfitTargetMaxPct,
        positionQty: 0,
        positionAvg: 0,
        lastPrice: price,
      })
      if (checked.ok && checked.proposal.quantity > 0) {
        try {
          const applied = await placeManagedFill({
            ledger,
            side: 'BUY',
            symbol: pick.symbol,
            qty: checked.proposal.quantity,
            price,
            stopLoss: checked.proposal.stop_loss,
            takeProfit: checked.proposal.take_profit,
            reason,
            pair: pairsBySymbol.get(pick.symbol),
          })
          ledger = applied.ledger
          decisions.push(
            filledRow(
              pick.symbol,
              price,
              checked.proposal,
              applied.fill.qty,
              applied.fill.price,
              applied.fill.notionalCad,
              applied.venue === 'kraken' ? `Bought on Kraken · fee CA$${applied.fill.feeCad.toFixed(2)}` : `Practice buy · fee CA$${applied.fill.feeCad.toFixed(2)}`,
              'BULLISH'
            )
          )
        } catch (err) {
          console.error('[tradebot] live buy', pick.symbol, err)
        }
      }
    }
  }

  const finalEquity = markToMarket(ledger, prices)
  const finalPnl = dayPnlPct(finalEquity, ledger.dayStartEquity)
  await savePaperLedger(ledger)
  return {
    ranAt: new Date().toISOString(),
    paper: !isPlacingLiveOrders(ledger),
    live: true,
    krakenLive: isPlacingLiveOrders(ledger),
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
    fills: await listRecentFills(12),
    marks,
    tickSeconds: settings.tickSeconds,
    engineOn: true,
  }
}
