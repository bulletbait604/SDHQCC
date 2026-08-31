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
import { liveEntryScore, liveHotScore, rankLiveBuys, recentlyBought, recentlyStopped, deskWaitNote } from '@/lib/tradebot/liveTapeRank'
import { isMemeTicker } from '@/lib/tradebot/opportunity'
import { fetchIndustryTape, fetchNewsForNames, headlinesTouchSymbol, type NewsTone } from '@/lib/tradebot/news'
import { barsToHourly, changeFromBars, hotEntry, swingEntry } from '@/lib/tradebot/swingSetup'
import { executeHardExits, pinStopsTakes, rollTorontoDay, swingLevels, trailStops } from '@/lib/tradebot/runtime'
import { getTradebotSettings, isPlacingLiveOrders, isTradebotDeskEnabled } from '@/lib/tradebot/settings'
import { isMajorCad, parseVolatility, volatilityProfile } from '@/lib/tradebot/volatility'
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
  huntNote: string
}

let ohlcCache: { at: number; key: string; bars: Record<string, DailyBar[]> } | null = null

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const worker = async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, () => worker()))
  return out
}

async function loadHuntBars(pairs: CryptoPair[]): Promise<Record<string, DailyBar[]>> {
  const key = pairs
    .map((p) => p.symbol)
    .sort()
    .join(',')
  if (ohlcCache && ohlcCache.key === key && Date.now() - ohlcCache.at < 90_000) return ohlcCache.bars
  const fx = pairs.some((p) => !p.nativeCad) ? await usdCadRate().catch(() => 1) : 1
  const bars: Record<string, DailyBar[]> = {}
  await mapPool(pairs, 5, async (pair) => {
    try {
      const tape = await fetchKrakenOhlc(pair, fx, 15)
      bars[pair.symbol] = tape.bars
    } catch {
      /* skip pair */
    }
  })
  ohlcCache = { at: Date.now(), key, bars }
  return bars
}

function pickTapeSymbols(markets: CryptoMarket[], held: string[], max = 14): string[] {
  const ranked = [...markets].sort((a, b) => {
    const score = (m: CryptoMarket) =>
      Math.abs(m.dayChangePct) +
      Math.log10(m.volume24h + 10) +
      (isMemeTicker(m.pair.symbol) ? 6 : 0) -
      (isMajorCad(m.pair.symbol) ? 4 : 0)
    return score(b) - score(a)
  })
  const out = new Set<string>(['BTC-CAD', ...held])
  for (const m of ranked) {
    out.add(m.pair.symbol)
    if (out.size >= max) break
  }
  return Array.from(out)
}

let newsCache: { at: number; key: string; tone: Record<string, NewsTone> } | null = null

async function loadHuntNews(symbols: string[]): Promise<Record<string, NewsTone>> {
  const key = [...symbols].sort().join(',')
  if (newsCache && newsCache.key === key && Date.now() - newsCache.at < 180_000) return newsCache.tone
  const tone: Record<string, NewsTone> = {}
  try {
    const [nameNews, tape] = await Promise.all([
      fetchNewsForNames(symbols.slice(0, 8).map((symbol) => ({ symbol }))),
      fetchIndustryTape().catch(() => []),
    ])
    const tapeTitles = tape.map((h) => h.title)
    for (const row of nameNews) {
      let t = row.tone
      if (t === 'quiet' && headlinesTouchSymbol(row.symbol, tapeTitles)) {
        t = 'mixed'
      }
      tone[row.symbol] = t
    }
    for (const symbol of symbols) {
      if (tone[symbol]) continue
      if (headlinesTouchSymbol(symbol, tapeTitles)) tone[symbol] = 'mixed'
    }
  } catch {
    /* hunt without news */
  }
  newsCache = { at: Date.now(), key, tone }
  return tone
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

function qtyNotional(qty: number, price: number): number {
  return Number((qty * price).toFixed(2))
}

function restingRow(ticker: string, price: number, proposal: TradeOrderProposal, note: string): CycleDecision {
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
      filled: false,
      side: proposal.action,
      quantity: proposal.quantity,
      price,
      notionalCad: qtyNotional(proposal.quantity, price),
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
      huntNote: deskWaitNote({
        engineOn: false,
        liveMode: Boolean(ledger.liveMode),
        halted: ledger.halted,
        haltReason: ledger.haltReason,
        profitLocked: false,
        holding: ledger.positions.length,
        maxOpen: vol.maxOpen,
        cash: ledger.cash,
        pendingSymbols: [],
        cooldown: false,
        skipReasons: [],
      }),
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

  const huntSymbols = pickTapeSymbols(
    markets,
    ledger.positions.map((p) => p.symbol),
    vol.level === 'low' ? 4 : 14
  )
  const huntPairs = pairs.filter((p) => huntSymbols.includes(p.symbol))
  const huntBars = await loadHuntBars(huntPairs)
  const newsTone = vol.level === 'low' ? {} : await loadHuntNews(huntSymbols)
  const liveEquity = markToMarket(ledger, prices)
  const livePnl = dayPnlPct(liveEquity, ledger.dayStartEquity)
  const recentFills = await listRecentFills(20, ledger.id)
  const pendingEntry = new Set(
    (ledger.openOrders || []).filter((o) => o.kind === 'entry' && o.side === 'BUY').map((o) => o.symbol)
  )
  const btcHourCloses = barsToHourly(huntBars['BTC-CAD'] || []).map((b) => b.c)
  const btcDayChangePct = markets.find((m) => m.pair.symbol === 'BTC-CAD')?.dayChangePct

  const held = new Set(ledger.positions.map((p) => p.symbol))
  const cooldown = recentlyBought(recentFills)
  const canBuy =
    !ledger.halted &&
    livePnl < settings.dailyProfitTargetMaxPct &&
    ledger.positions.length < vol.maxOpen &&
    ledger.cash >= 5 &&
    pendingEntry.size + ledger.positions.length < vol.maxOpen &&
    !cooldown

  const skipReasons: string[] = []
  let buyError = ''
  if (canBuy) {
    const scored = markets
      .filter((m) => huntSymbols.includes(m.pair.symbol))
      .map((m) => {
      const bars15 = huntBars[m.pair.symbol] || []
      const series = bars15.map((b) => b.c)
      const rsiNow = rsi(series) ?? 52
      const news = newsTone[m.pair.symbol]
      const swing = swingEntry({
        symbol: m.pair.symbol,
        bars15,
        price: m.bid > 0 ? m.bid : m.quote.price,
        dayChangePct: m.dayChangePct,
        spreadPct: m.spreadPct,
        btcHourCloses,
        volatility: vol.level,
      })
      const hot = hotEntry({
        symbol: m.pair.symbol,
        bars15,
        price: m.bid > 0 ? m.bid : m.quote.price,
        dayChangePct: m.dayChangePct,
        spreadPct: m.spreadPct,
        volume24h: m.volume24h,
        newsTone: news,
        btcDayChangePct,
        volatility: vol.level,
      })
      const setup = [swing, hot]
        .filter((s) => s.ok)
        .sort((a, b) => b.scoreBoost - a.scoreBoost)[0] || swing
      const blocked = recentlyStopped(recentFills, m.pair.symbol) || pendingEntry.has(m.pair.symbol)
      const reason = blocked
        ? recentlyStopped(recentFills, m.pair.symbol)
          ? 'Cooldown after a stop on this coin.'
          : 'Maker buy already resting.'
        : setup.ok
          ? setup.reason
          : vol.level === 'low'
            ? swing.reason
            : hot.reason
      skipReasons.push(reason)
      const useHot = hot.ok && (!swing.ok || hot.scoreBoost >= swing.scoreBoost)
      return {
        symbol: m.pair.symbol,
        dayChangePct: m.dayChangePct,
        volume24h: m.volume24h,
        stopPct: setup.stopPct,
        takePct: setup.takePct,
        reason,
        score:
          setup.ok && !blocked
            ? (useHot
                ? liveHotScore(
                    { symbol: m.pair.symbol, dayChangePct: m.dayChangePct, volume24h: m.volume24h },
                    { newsTone: news, change1h: changeFromBars(bars15, 4) }
                  )
                : liveEntryScore(
                    { symbol: m.pair.symbol, dayChangePct: m.dayChangePct, volume24h: m.volume24h, rsi: rsiNow },
                    vol.level
                  )) + setup.scoreBoost
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
          } else {
            decisions.push(
              restingRow(
                pick.symbol,
                price,
                checked.proposal,
                applied.venue === 'kraken'
                  ? 'Maker buy posted on Kraken — waiting for a fill at the bid.'
                  : 'Practice maker buy posted — waiting for a fill at the bid.'
              )
            )
          }
        } catch (err) {
          buyError = err instanceof Error ? err.message : 'Could not place the buy.'
          console.error('[tradebot] live buy', pick.symbol, err)
        }
      } else {
        buyError = (checked.reasons || []).join(' ') || 'Safety blocked the ticket size.'
      }
    }
  }

  const pendingNow = (ledger.openOrders || [])
    .filter((o) => o.kind === 'entry' && o.side === 'BUY')
    .map((o) => o.symbol)
  let huntNote = deskWaitNote({
    engineOn: true,
    liveMode: Boolean(ledger.liveMode),
    halted: ledger.halted,
    haltReason: ledger.haltReason,
    profitLocked: livePnl >= settings.dailyProfitTargetMaxPct,
    holding: ledger.positions.length,
    maxOpen: vol.maxOpen,
    cash: ledger.cash,
    pendingSymbols: pendingNow,
    cooldown,
    skipReasons,
    buyError,
  })
  const bought = decisions.find((d) => d.fill?.filled && d.fill.side === 'BUY')
  if (bought) {
    huntNote = `Bought ${bought.ticker.replace(/-CAD$/i, '')}. Waiting for take or stop.`
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
    huntNote,
  }
}
