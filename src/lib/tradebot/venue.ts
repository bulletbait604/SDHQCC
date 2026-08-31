import { isCryptoSymbol, type CryptoPair } from '@/lib/tradebot/crypto'
import { applyFill, type PaperLedger } from '@/lib/tradebot/ledger'
import { krakenCadBalance, krakenMarketOrder } from '@/lib/tradebot/krakenPrivate'
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
}): Promise<{ ledger: PaperLedger; fill: Awaited<ReturnType<typeof applyFill>>['fill']; venue: 'paper' | 'kraken' }> {
  const settings = getTradebotSettings()
  let qty = params.qty
  const live = isPlacingLiveOrders(params.ledger)
  if (live) {
    if (!params.pair || !isCryptoSymbol(params.symbol)) {
      throw new Error(`No Kraken CAD pair for ${params.symbol}. Live order skipped.`)
    }
    const min = params.pair.ordermin > 0 ? params.pair.ordermin : 0
    if (qty < min) qty = min
    const cost = qty * params.price
    if (params.side === 'BUY' && cost > params.ledger.cash + 0.01) {
      throw new Error(
        `Kraken minimum size for ${params.symbol} costs about CA$${cost.toFixed(2)}, more than cash CA$${params.ledger.cash.toFixed(2)}.`
      )
    }
    await krakenMarketOrder({
      krakenId: params.pair.krakenId,
      side: params.side,
      volume: qty,
    })
  }
  const applied = await applyFill({
    ledger: params.ledger,
    side: params.side,
    symbol: params.symbol,
    qty,
    price: params.price,
    feeBps: isCryptoSymbol(params.symbol) ? settings.krakenFeeBps : settings.tsxFeeBps,
    stopLoss: params.stopLoss,
    takeProfit: params.takeProfit,
    reason: params.reason,
  })
  return { ...applied, venue: live ? 'kraken' : 'paper' }
}
