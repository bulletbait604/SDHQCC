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

export async function krakenCadBalance(): Promise<number> {
  const result = await privateCall('Balance')
  const cad = Number(result.ZCAD ?? result.CAD ?? 0)
  return Number.isFinite(cad) ? cad : 0
}

export async function krakenMarketOrder(params: {
  krakenId: string
  side: 'BUY' | 'SELL'
  volume: number
}): Promise<{ txid: string; volume: number }> {
  const volume = Math.max(params.volume, 0)
  if (!(volume > 0)) throw new Error('Kraken order volume must be positive.')
  const result = await privateCall('AddOrder', {
    pair: params.krakenId,
    type: params.side === 'BUY' ? 'buy' : 'sell',
    ordertype: 'market',
    volume: Number(volume.toFixed(8)).toString(),
  })
  const txids = Array.isArray(result.txid) ? result.txid : []
  const txid = typeof txids[0] === 'string' ? txids[0] : ''
  if (!txid) throw new Error('Kraken did not return an order id.')
  return { txid, volume }
}
