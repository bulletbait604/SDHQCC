import { isCryptoSymbol, type CryptoPair } from '@/lib/tradebot/crypto'
import { feeBpsForKind, STALE_ENTRY_MS } from '@/lib/tradebot/fees'
import { quantityRespectingMinLot } from '@/lib/tradebot/guardrails'
import { applyFill, savePaperLedger, type OpenDeskOrder, type PaperLedger } from '@/lib/tradebot/ledger'
import {
  krakenCadBalance,
  krakenCancelOrder,
  krakenLimitPostOnly,
  krakenMarketOrder,
  krakenQueryOrders,
  krakenStopLossSell,
  krakenTakeProfitLimit,
  waitForKrakenFill,
} from '@/lib/tradebot/krakenPrivate'
import { getTradebotSettings, isPlacingLiveOrders } from '@/lib/tradebot/settings'

export async function syncLiveCash(ledger: PaperLedger): Promise<PaperLedger> {
  if (!isPlacingLiveOrders(ledger)) return ledger
  try {
    const cad = await krakenCadBalance()
    if (cad >= 0) ledger.cash = cad
  } catch (err) {
    console.error('[tradebot] Kraken balance', err)
  }
  return ledger
}

function pushOrder(ledger: PaperLedger, order: OpenDeskOrder): void {
  ledger.openOrders = [...(ledger.openOrders || []).filter((o) => o.txid !== order.txid), order]
}

function dropOrders(ledger: PaperLedger, pred: (o: OpenDeskOrder) => boolean): void {
  ledger.openOrders = (ledger.openOrders || []).filter((o) => !pred(o))
}

async function cancelQuiet(txid: string): Promise<void> {
  try {
    await krakenCancelOrder(txid)
  } catch (err) {
    console.error('[tradebot] cancel', txid, err)
  }
}

export async function cancelProtectiveOrders(ledger: PaperLedger, symbol: string): Promise<PaperLedger> {
  const next = ledger
  for (const o of [...(next.openOrders || [])]) {
    if (o.symbol !== symbol || (o.kind !== 'stop' && o.kind !== 'take' && o.kind !== 'entry')) continue
    await cancelQuiet(o.txid)
  }
  dropOrders(next, (o) => o.symbol === symbol)
  return next
}

async function attachProtective(ledger: PaperLedger, pair: CryptoPair, pos: { symbol: string; qty: number; stopLoss: number; takeProfit: number }): Promise<PaperLedger> {
  if (!pair.nativeCad) return ledger
  dropOrders(ledger, (o) => o.symbol === pos.symbol && (o.kind === 'stop' || o.kind === 'take'))
  try {
    if (pos.stopLoss > 0) {
      const stop = await krakenStopLossSell({
        krakenId: pair.krakenId,
        volume: pos.qty,
        trigger: pos.stopLoss,
        pairDecimals: pair.pairDecimals,
        lotDecimals: pair.lotDecimals,
      })
      pushOrder(ledger, {
        txid: stop.txid,
        symbol: pos.symbol,
        side: 'SELL',
        kind: 'stop',
        qty: pos.qty,
        price: pos.stopLoss,
        placedAt: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.error('[tradebot] native stop', pos.symbol, err)
  }
  try {
    if (pos.takeProfit > 0) {
      const take = await krakenTakeProfitLimit({
        krakenId: pair.krakenId,
        volume: pos.qty,
        price: pos.takeProfit,
        pairDecimals: pair.pairDecimals,
        lotDecimals: pair.lotDecimals,
      })
      pushOrder(ledger, {
        txid: take.txid,
        symbol: pos.symbol,
        side: 'SELL',
        kind: 'take',
        qty: pos.qty,
        price: pos.takeProfit,
        placedAt: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.error('[tradebot] native take', pos.symbol, err)
  }
  return ledger
}

export async function replaceNativeStop(
  ledger: PaperLedger,
  pair: CryptoPair,
  symbol: string,
  trigger: number
): Promise<PaperLedger> {
  if (!isPlacingLiveOrders(ledger)) return ledger
  if (!pair.nativeCad) return ledger
  const pos = ledger.positions.find((p) => p.symbol === symbol)
  if (!pos || !(trigger > 0)) return ledger
  const old = (ledger.openOrders || []).filter((o) => o.symbol === symbol && o.kind === 'stop')
  for (const o of old) await cancelQuiet(o.txid)
  dropOrders(ledger, (o) => o.symbol === symbol && o.kind === 'stop')
  try {
    const stop = await krakenStopLossSell({
      krakenId: pair.krakenId,
      volume: pos.qty,
      trigger,
      pairDecimals: pair.pairDecimals,
      lotDecimals: pair.lotDecimals,
    })
    pushOrder(ledger, {
      txid: stop.txid,
      symbol,
      side: 'SELL',
      kind: 'stop',
      qty: pos.qty,
      price: trigger,
      placedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[tradebot] replace stop', symbol, err)
  }
  return ledger
}

export async function reconcileKrakenOrders(
  ledger: PaperLedger,
  pairsBySymbol: Map<string, CryptoPair>
): Promise<PaperLedger> {
  if (!isPlacingLiveOrders(ledger)) return ledger
  const open = [...(ledger.openOrders || [])]
  if (!open.length) return ledger
  let next = ledger
  const settings = getTradebotSettings()
  let states: Awaited<ReturnType<typeof krakenQueryOrders>> = []
  try {
    states = await krakenQueryOrders(open.map((o) => o.txid))
  } catch (err) {
    console.error('[tradebot] query orders', err)
    return next
  }
  const byTx = new Map(states.map((s) => [s.txid, s]))
  const now = Date.now()
  for (const order of open) {
    const state = byTx.get(order.txid)
    if (!state) continue
    if (state.filled && state.volExec > 0) {
      const px = state.avgPrice > 0 ? state.avgPrice : order.price
      const kind = order.kind === 'stop' ? 'taker' : 'maker'
      try {
        if (order.kind !== 'entry') {
          await cancelProtectiveOrders(next, order.symbol)
        }
        const applied = await applyFill({
          ledger: next,
          side: order.side,
          symbol: order.symbol,
          qty: state.volExec > 0 ? state.volExec : order.qty,
          price: px,
          feeBps: isCryptoSymbol(order.symbol)
            ? feeBpsForKind(kind, settings.krakenMakerBps, settings.krakenTakerBps)
            : settings.tsxFeeBps,
          stopLoss: order.stopLoss || 0,
          takeProfit: order.takeProfit || 0,
          reason:
            order.kind === 'stop'
              ? `Stop-loss ${order.price}`
              : order.kind === 'take'
                ? `Take-profit ${order.price}`
                : 'Limit filled on Kraken',
        })
        next = applied.ledger
        dropOrders(next, (o) => o.txid === order.txid)
        if (order.side === 'BUY') {
          const pos = next.positions.find((p) => p.symbol === order.symbol)
          const pair = pairsBySymbol.get(order.symbol)
          if (pos && pair) next = await attachProtective(next, pair, pos)
        }
      } catch (err) {
        console.error('[tradebot] reconcile fill', order.symbol, err)
      }
      continue
    }
    if (!state.open) {
      dropOrders(next, (o) => o.txid === order.txid)
      continue
    }
    if (order.kind === 'entry') {
      const age = now - Date.parse(order.placedAt)
      if (Number.isFinite(age) && age > STALE_ENTRY_MS) {
        await cancelQuiet(order.txid)
        dropOrders(next, (o) => o.txid === order.txid)
      }
    }
  }
  await savePaperLedger(next)
  return next
}

export async function placeManagedFill(params: {
  ledger: PaperLedger
  side: 'BUY' | 'SELL'
  symbol: string
  qty: number
  price: number
  stopLoss: number
  takeProfit: number
  reason: string
  pair?: CryptoPair
  execution?: 'limit' | 'market'
  equity?: number
  venuePrice?: number
}): Promise<{
  ledger: PaperLedger
  fill: Awaited<ReturnType<typeof applyFill>>['fill'] | null
  venue: 'paper' | 'kraken'
}> {
  const settings = getTradebotSettings()
  let qty = params.qty
  const live = isPlacingLiveOrders(params.ledger)
  const execution = params.execution || (params.side === 'BUY' ? 'limit' : 'market')
  const maker = execution === 'limit'
  const feeBps = isCryptoSymbol(params.symbol)
    ? feeBpsForKind(maker ? 'maker' : 'taker', settings.krakenMakerBps, settings.krakenTakerBps)
    : settings.tsxFeeBps

  if (params.pair && isCryptoSymbol(params.symbol)) {
    const min = params.pair.ordermin > 0 ? params.pair.ordermin : 0
    const equity = params.equity && params.equity > 0 ? params.equity : params.ledger.cash + qty * params.price
    qty = quantityRespectingMinLot({
      qty,
      minLot: min,
      price: params.price,
      cash: params.side === 'BUY' ? params.ledger.cash : Infinity,
      maxNotional: equity * 0.6,
    })
    if (!(qty > 0)) {
      throw new Error(`Kraken minimum size for ${params.symbol} is larger than the position cap.`)
    }
  }

  if (live) {
    if (!params.pair || !isCryptoSymbol(params.symbol)) {
      throw new Error(`No Kraken CAD pair for ${params.symbol}. Live order skipped.`)
    }
    const cost = qty * params.price
    if (params.side === 'BUY' && cost > params.ledger.cash + 0.01) {
      throw new Error(
        `Kraken minimum size for ${params.symbol} costs about CA$${cost.toFixed(2)}, more than cash CA$${params.ledger.cash.toFixed(2)}.`
      )
    }
    const sendPrice = params.venuePrice && params.venuePrice > 0 ? params.venuePrice : params.price
    if (params.side === 'SELL') {
      await cancelProtectiveOrders(params.ledger, params.symbol)
    }
    if (execution === 'limit') {
      const placed = await krakenLimitPostOnly({
        krakenId: params.pair.krakenId,
        side: params.side,
        volume: qty,
        price: sendPrice,
        pairDecimals: params.pair.pairDecimals,
        lotDecimals: params.pair.lotDecimals,
      })
      const filled = await waitForKrakenFill(placed.txid)
      if (!filled?.filled) {
        pushOrder(params.ledger, {
          txid: placed.txid,
          symbol: params.symbol,
          side: params.side,
          kind: params.side === 'BUY' ? 'entry' : 'take',
          qty,
          price: params.price,
          placedAt: new Date().toISOString(),
          stopLoss: params.stopLoss,
          takeProfit: params.takeProfit,
        })
        await savePaperLedger(params.ledger)
        return { ledger: params.ledger, fill: null, venue: 'kraken' }
      }
      qty = filled.volExec > 0 ? filled.volExec : qty
      if (filled.avgPrice > 0) {
        params.price = sendPrice > 0 ? filled.avgPrice * (params.price / sendPrice) : filled.avgPrice
      }
    } else {
      await krakenMarketOrder({
        krakenId: params.pair.krakenId,
        side: params.side,
        volume: qty,
        lotDecimals: params.pair.lotDecimals,
      })
    }
  }

  const applied = await applyFill({
    ledger: params.ledger,
    side: params.side,
    symbol: params.symbol,
    qty,
    price: params.price,
    feeBps,
    stopLoss: params.stopLoss,
    takeProfit: params.takeProfit,
    reason: params.reason,
  })

  if (live && params.side === 'BUY' && params.pair) {
    const pos = applied.ledger.positions.find((p) => p.symbol === params.symbol)
    if (pos) {
      applied.ledger = await attachProtective(applied.ledger, params.pair, pos)
      await savePaperLedger(applied.ledger)
    }
  }

  return { ...applied, venue: live ? 'kraken' : 'paper' }
}
