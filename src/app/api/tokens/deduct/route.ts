import { NextRequest, NextResponse } from 'next/server'
import { POST as coinsDeductPost } from '@/app/api/coins/deduct/route'
import {
  attachTokenDeprecation,
  legacyTokenToolToCoinTool,
  mapCoinsBodyToTokens,
} from '@/lib/coins/tokenLegacyProxy'

/** @deprecated Use POST /api/coins/deduct */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const legacyTool = typeof body.tool === 'string' ? body.tool : ''
  const proxiedReq = new NextRequest(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({ tool: legacyTokenToolToCoinTool(legacyTool) }),
  })
  const res = await coinsDeductPost(proxiedReq)
  const resBody = (await res.json()) as Record<string, unknown>
  const mapped = mapCoinsBodyToTokens(resBody)
  return attachTokenDeprecation(NextResponse.json(mapped, { status: res.status }))
}
