import crypto from 'node:crypto'
import { krakenApiKey, krakenApiSecret } from '@/lib/tradebot/settings'

const PRIVATE = 'https://api.kraken.com'

function sign(path: string, nonce: string, postData: string, secretB64: string): string {
  const sha256 = crypto.createHash('sha256').update(nonce + postData).digest()
  const secret = Buffer.from(secretB64, 'base64')
  return crypto.createHmac('sha512', secret).update(Buffer.concat([Buffer.from(path), sha256])).digest('base64')
}

async function privateCall(method: string, extra: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const key = krakenApiKey()
  const secret = krakenApiSecret()
  if (!key || !secret) throw new Error('Kraken API key and secret are required for live orders.')
  const nonce = String(Date.now() * 1000)
  const body = new URLSearchParams({ nonce, ...extra }).toString()
  const path = `/0/private/${method}`
  const res = await fetch(`${PRIVATE}${path}`, {
    method: 'POST',
    headers: {
      'API-Key': key,
      'API-Sign': sign(path, nonce, body, secret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(12_000),
    cache: 'no-store',
  })
  const json = (await res.json()) as { error?: string[]; result?: Record<string, unknown> }
  const errs = Array.isArray(json.error) ? json.error.filter(Boolean) : []
  if (errs.length) throw new Error(errs.join('; '))
  return json.result && typeof json.result === 'object' ? json.result : {}
}

function fmtDec(n: number, decimals: number): string {
  return Number(n.toFixed(Math.min(8, Math.max(0, decimals)))).toString()
}

export async function krakenCadBalance(): Promise<number> {
  const result = await privateCall('Balance')
  const cad = Number(result.ZCAD ?? result.CAD ?? 0)
  return Number.isFinite(cad) ? cad : 0
}

export type KrakenOrderKind = 'market' | 'limit' | 'stop-loss' | 'take-profit'

export async function krakenAddOrder(params: {
  krakenId: string
  side: 'BUY' | 'SELL'
  ordertype: KrakenOrderKind
  volume: number
  price?: number
  oflags?: string
  pairDecimals?: number
  lotDecimals?: number
}): Promise<{ txid: string; volume: number }> {
  const volume = Math.max(params.volume, 0)
  if (!(volume > 0)) throw new Error('Kraken order volume must be positive.')
  const extra: Record<string, string> = {
    pair: params.krakenId,
    type: params.side === 'BUY' ? 'buy' : 'sell',
    ordertype: params.ordertype,
    volume: fmtDec(volume, params.lotDecimals ?? 8),
  }
  if (params.ordertype !== 'market') {
    if (!(params.price && params.price > 0)) throw new Error('Kraken limit/stop orders need a price.')
    extra.price = fmtDec(params.price, params.pairDecimals ?? 5)
  }
  if (params.oflags) extra.oflags = params.oflags
  const result = await privateCall('AddOrder', extra)
  const txids = Array.isArray(result.txid) ? result.txid : []
  const txid = typeof txids[0] === 'string' ? txids[0] : ''
  if (!txid) throw new Error('Kraken did not return an order id.')
  return { txid, volume }
}

export async function krakenMarketOrder(params: {
  krakenId: string
  side: 'BUY' | 'SELL'
  volume: number
  lotDecimals?: number
}): Promise<{ txid: string; volume: number }> {
  return krakenAddOrder({
    krakenId: params.krakenId,
    side: params.side,
    ordertype: 'market',
    volume: params.volume,
    lotDecimals: params.lotDecimals,
  })
}

export async function krakenLimitPostOnly(params: {
  krakenId: string
  side: 'BUY' | 'SELL'
  volume: number
  price: number
  pairDecimals?: number
  lotDecimals?: number
}): Promise<{ txid: string; volume: number }> {
  return krakenAddOrder({
    ...params,
    ordertype: 'limit',
    oflags: 'post',
  })
}

export async function krakenStopLossSell(params: {
  krakenId: string
  volume: number
  trigger: number
  pairDecimals?: number
  lotDecimals?: number
}): Promise<{ txid: string; volume: number }> {
  return krakenAddOrder({
    krakenId: params.krakenId,
    side: 'SELL',
    ordertype: 'stop-loss',
    volume: params.volume,
    price: params.trigger,
    pairDecimals: params.pairDecimals,
    lotDecimals: params.lotDecimals,
  })
}

export async function krakenTakeProfitLimit(params: {
  krakenId: string
  volume: number
  price: number
  pairDecimals?: number
  lotDecimals?: number
}): Promise<{ txid: string; volume: number }> {
  return krakenAddOrder({
    krakenId: params.krakenId,
    side: 'SELL',
    ordertype: 'limit',
    volume: params.volume,
    price: params.price,
    oflags: 'post',
    pairDecimals: params.pairDecimals,
    lotDecimals: params.lotDecimals,
  })
}

export type KrakenOrderState = {
  txid: string
  status: string
  vol: number
  volExec: number
  avgPrice: number
  filled: boolean
  open: boolean
}

export async function krakenQueryOrders(txids: string[]): Promise<KrakenOrderState[]> {
  const ids = txids.filter(Boolean)
  if (!ids.length) return []
  const result = await privateCall('QueryOrders', { txid: ids.join(',') })
  return ids.map((txid) => {
    const row = result[txid] && typeof result[txid] === 'object' ? (result[txid] as Record<string, unknown>) : {}
    const status = String(row.status || '')
    const vol = Number(row.vol || 0)
    const volExec = Number(row.vol_exec || 0)
    const avgPrice = Number(row.price || 0)
    const filled = status === 'closed' || (volExec > 0 && volExec + 1e-12 >= vol)
    const open = status === 'open' || status === 'pending'
    return { txid, status, vol, volExec, avgPrice, filled, open }
  })
}

export async function krakenCancelOrder(txid: string): Promise<void> {
  if (!txid) return
  await privateCall('CancelOrder', { txid })
}

export async function waitForKrakenFill(
  txid: string,
  attempts = 5,
  delayMs = 700
): Promise<KrakenOrderState | null> {
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs))
    const [state] = await krakenQueryOrders([txid])
    if (!state) continue
    if (state.filled || !state.open) return state
  }
  const [last] = await krakenQueryOrders([txid])
  return last || null
}
