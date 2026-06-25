import { NextRequest, NextResponse } from 'next/server'
import { GET as coinsBalanceGet } from '@/app/api/coins/balance/route'
import { attachTokenDeprecation, mapCoinsBodyToTokens } from '@/lib/coins/tokenLegacyProxy'

/** @deprecated Use GET /api/coins/balance */
export async function GET(req: NextRequest) {
  const res = await coinsBalanceGet(req)
  const body = (await res.json()) as Record<string, unknown>
  const mapped = mapCoinsBodyToTokens(body)
  return attachTokenDeprecation(NextResponse.json(mapped, { status: res.status }))
}
