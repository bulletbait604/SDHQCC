import {
  cadToVenuePrice,
  fetchKrakenOhlc,
  listLiquidKrakenPairs,
  quoteKrakenMarkets,
  usdCadRate,
  type CryptoMarket,
  type CryptoPair,
} from '@/lib/tradebot/crypto'
import { swingTrailActivatePct } from '@/lib/tradebot/fees'
import { sizeBuyQuantity, validateTrade, dayPnlPct } from '@/lib/tradebot/guardrails'
import { rsi } from '@/lib/tradebot/indicators'
import type { DailyBar } from '@/lib/tradebot/quotes'
import {
  listRecentFills,
  loadPaperLedger,
  markToMarket,
  savePaperLedger,
} from '@/lib/tradebot/ledger'
import type { CycleDecision, TradeOrderProposal } from '@/lib/tradebot/models'
import { liveEntryScore, rankLiveBuys, recentlyBought, recentlyStopped } from '@/lib/tradebot/liveTapeRank'
import { barsToHourly, swingEntry } from '@/lib/tradebot/swingSetup'
import { executeHardExits, pinStopsTakes, rollTorontoDay, swingLevels, trailStops } from '@/lib/tradebot/runtime'
import { getTradebotSettings, isPlacingLiveOrders, isTradebotDeskEnabled } from '@/lib/tradebot/settings'
import { parseVolatility, volatilityProfile } from '@/lib/tradebot/volatility'
import { placeManagedFill, reconcileKrakenOrders, replaceNativeStop, syncLiveCash } from '@/lib/tradebot/venue'

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

let ohlcCache: { at: number; bars: Record<string, DailyBar[]> } | null = null

async function loadHuntBars(pairs: CryptoPair[]): Promise<Record<string, DailyBar[]>> {
  if (ohlcCache && Date.now() - ohlcCache.at < 90_000) return ohlcCache.bars
  const fx = pairs.some((p) => !p.nativeCad) ? await usdCadRate().catch(() => 1) : 1
  const bars: Record<string, DailyBar[]> = {}
  for (const pair of pairs) {
    try {
      const tape = await fetchKrakenOhlc(pair, fx, 15)
      bars[pair.symbol] = tape.bars
    } catch {
      /* skip pair */
    }
  }
  ohlcCache = { at: Date.now(), bars }
  return bars
}

let heldOhlcCache: { at: number; key: string; closes: Record<string, number[]> } | null = null

async function loadHeldCloses(pairs: CryptoPair[]): Promise<Record<string, number[]>> {
  if (!pairs.length) return {}
  const key = pairs.map((p) => p.symbol).sort().join(',')
  if (heldOhlcCache && heldOhlcCache.key === key && Date.now() - heldOhlcCache.at < 25_000) {
    return heldOhlcCache.closes
  }
  const fx = pairs.some((p) => !p.nativeCad) ? await usdCadRate().catch(() => 1) : 1
  const closes: Record<string, number[]> = {}
  for (const pair of pairs) {
    try {
      const { bars } = await fetchKrakenOhlc(pair, fx, 5)
      closes[pair.symbol] = bars.map((b) => b.c)
    } catch {
      /* skip pair */
    }
  }
  heldOhlcCache = { at: Date.now(), key, closes }
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
    if (ledger.liveMode) {
      try {
        ledger = await syncLiveCash(ledger)
      } catch (err) {
        console.error('[tradebot] Kraken CAD', err)
      }
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
      fills: await listRecentFills(12, ledger.id),
      marks,
      tickSeconds: settings.tickSeconds,
      engineOn: false,
    }
  }

  if (ledger.liveMode) {
    try {
      ledger = await syncLiveCash(ledger)
    } catch (err) {
      console.error('[tradebot] Kraken CAD', err)
    }
  }
  ledger = await reconcileKrakenOrders(ledger, pairsBySymbol)
  let equity = markToMarket(ledger, prices)
  ledger = rollTorontoDay(ledger, equity)
  pinStopsTakes(ledger, { stopPct: vol.stopPct, takePct: vol.takePct })
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

  const heldPairs = pairs.filter((p) => ledger.positions.some((pos) => pos.symbol === p.symbol))
  const heldCloses = await loadHeldCloses(heldPairs)
  const trailPrices: Record<string, number> = { ...prices }
  for (const pos of ledger.positions) {
    const series = heldCloses[pos.symbol]
    const last5 = series && series.length ? series[series.length - 1] : 0
    if (last5 > 0) trailPrices[pos.symbol] = last5
  }
  if (!ledger.halted) {
    const moved = trailStops(ledger, trailPrices, {
      activatePct: swingTrailActivatePct(vol.takePct, vol.trailPct, settings.krakenMakerBps, settings.krakenTakerBps),
      trailPct: vol.trailPct,
      makerBps: settings.krakenMakerBps,
      takerBps: settings.krakenTakerBps,
    })
    if (placingLive) {
      for (const symbol of moved) {
        const pos = ledger.positions.find((p) => p.symbol === symbol)
        const pair = pairsBySymbol.get(symbol)
        if (pos && pair) ledger = await replaceNativeStop(ledger, pair, symbol, pos.stopLoss)
      }
    }
  }

  const huntBars = await loadHuntBars(pairs)
  const liveEquity = markToMarket(ledger, prices)
  const livePnl = dayPnlPct(liveEquity, ledger.dayStartEquity)
  const recentFills = await listRecentFills(20, ledger.id)
  const pendingEntry = new Set(
    (ledger.openOrders || []).filter((o) => o.kind === 'entry' && o.side === 'BUY').map((o) => o.symbol)
  )
  const btcHourCloses = barsToHourly(huntBars['BTC-CAD'] || []).map((b) => b.c)

  const held = new Set(ledger.positions.map((p) => p.symbol))
  const canBuy =
    !ledger.halted &&
    livePnl < settings.dailyProfitTargetMaxPct &&
    ledger.positions.length < vol.maxOpen &&
    ledger.cash >= 5 &&
    pendingEntry.size + ledger.positions.length < vol.maxOpen &&
    !recentlyBought(recentFills)

  if (canBuy) {
    const scored = markets.map((m) => {
      const bars15 = huntBars[m.pair.symbol] || []
      const series = bars15.map((b) => b.c)
      const rsiNow = rsi(series) ?? 52
      const setup = swingEntry({
        symbol: m.pair.symbol,
        bars15,
        price: m.bid > 0 ? m.bid : m.quote.price,
        dayChangePct: m.dayChangePct,
        spreadPct: m.spreadPct,
        btcHourCloses,
        volatility: vol.level,
      })
      const blocked = recentlyStopped(recentFills, m.pair.symbol) || pendingEntry.has(m.pair.symbol)
      return {
        symbol: m.pair.symbol,
        dayChangePct: m.dayChangePct,
        volume24h: m.volume24h,
        stopPct: setup.stopPct,
        takePct: setup.takePct,
        reason: setup.reason,
        score:
          setup.ok && !blocked
            ? liveEntryScore(
                { symbol: m.pair.symbol, dayChangePct: m.dayChangePct, volume24h: m.volume24h, rsi: rsiNow },
                vol.level
              ) + setup.scoreBoost
            : 0,
      }
    })
    const pick = rankLiveBuys(scored, held)[0]
    const market = pick ? markets.find((m) => m.pair.symbol === pick.symbol) : undefined
    if (market && pick && (pick.score || 0) > 0) {
      const price = market.bid > 0 ? market.bid : market.quote.price
      const stopPct = pick.stopPct || vol.stopPct
      const takePct = pick.takePct || vol.takePct
      const levels = swingLevels(price, { stopPct, takePct })
      const atrDist = Math.max(price * stopPct, 0.000001)
      const quantity = sizeBuyQuantity({
        equity: liveEquity,
        riskPct: settings.riskPct,
        atr: atrDist,
        atrMultiplier: 1,
        price,
        maxAssetWeightPct: vol.maxAssetWeightPct,
      })
      const reason = pick.reason || `Swing buy ${pick.symbol.replace(/-CAD$/, '')}.`
      const proposal: TradeOrderProposal = {
        ticker: pick.symbol,
        action: 'BUY',
        order_type: 'LIMIT',
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
            execution: 'limit',
            equity: liveEquity,
            venuePrice: cadToVenuePrice(market.pair, price, market.bid, market.nativeBid),
          })
          ledger = applied.ledger
          if (applied.fill) {
            decisions.push(
              filledRow(
                pick.symbol,
                price,
                checked.proposal,
                applied.fill.qty,
                applied.fill.price,
                applied.fill.notionalCad,
                applied.venue === 'kraken'
                  ? `Maker buy on Kraken · fee CA$${applied.fill.feeCad.toFixed(2)}`
                  : `Practice maker buy · fee CA$${applied.fill.feeCad.toFixed(2)}`,
                'BULLISH'
              )
            )
          }
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
    fills: await listRecentFills(12, ledger.id),
    marks,
    tickSeconds: settings.tickSeconds,
    engineOn: true,
  }
}
