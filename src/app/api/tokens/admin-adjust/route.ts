import { NextRequest, NextResponse } from 'next/server'
import { POST as coinsAdminAdjustPost } from '@/app/api/coins/admin-adjust/route'
import { attachTokenDeprecation, mapCoinsBodyToTokens } from '@/lib/coins/tokenLegacyProxy'

/** @deprecated Use POST /api/coins/admin-adjust — body uses `coins` instead of `tokens`. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const tokens = typeof body.tokens === 'number' ? body.tokens : undefined
  const coins = typeof body.coins === 'number' ? body.coins : tokens
  const proxiedReq = new NextRequest(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({
      targetUsername: body.targetUsername,
      coins,
    }),
  })
  const res = await coinsAdminAdjustPost(proxiedReq)
  const resBody = (await res.json()) as Record<string, unknown>
  const mapped = mapCoinsBodyToTokens(resBody)
  if (typeof mapped.balance === 'number' && mapped.tokens === undefined) {
    mapped.tokens = mapped.balance
  }
  if (typeof mapped.coins === 'number' && mapped.granted === undefined && tokens !== undefined) {
    mapped.granted = Math.abs(tokens)
  }
  return attachTokenDeprecation(NextResponse.json(mapped, { status: res.status }))
}
