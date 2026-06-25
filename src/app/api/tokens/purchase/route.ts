import { NextRequest, NextResponse } from 'next/server'
import { POST as coinsPurchasePost } from '@/app/api/coins/purchase/route'
import { attachTokenDeprecation, mapCoinsBodyToTokens } from '@/lib/coins/tokenLegacyProxy'

const LEGACY_PACKAGE_MAP: Record<string, 'small' | 'medium' | 'large'> = {
  basic: 'small',
  standard: 'medium',
  premium: 'large',
}

/** @deprecated Use POST /api/coins/purchase */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const packageType =
    typeof body.packageType === 'string' ? LEGACY_PACKAGE_MAP[body.packageType] ?? body.packageType : body.packageType
  const proxiedReq = new NextRequest(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({
      packageType,
      currency: body.currency,
    }),
  })
  const res = await coinsPurchasePost(proxiedReq)
  const resBody = (await res.json()) as Record<string, unknown>
  const mapped = mapCoinsBodyToTokens(resBody)
  if (typeof mapped.coins === 'number' && mapped.tokens === undefined) {
    mapped.tokens = mapped.coins
  }
  return attachTokenDeprecation(NextResponse.json(mapped, { status: res.status }))
}
