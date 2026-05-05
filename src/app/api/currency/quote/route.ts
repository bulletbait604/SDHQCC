import { NextRequest, NextResponse } from 'next/server'
import {
  convertCadAmount,
  detectCurrencyFromHeaders,
  SUPPORTED_PAYPAL_CURRENCIES,
} from '@/lib/currency'

export const dynamic = 'force-dynamic'

function parseCadAmounts(search: URLSearchParams): number[] {
  const raw = search.get('amountCad') ?? search.get('amountsCad') ?? ''
  const values = raw
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 20)
  return values
}

export async function GET(req: NextRequest) {
  const requested = (req.nextUrl.searchParams.get('currency') ?? '').toUpperCase().trim()
  const detected = detectCurrencyFromHeaders(req.headers)
  const currency =
    requested && SUPPORTED_PAYPAL_CURRENCIES.has(requested) ? requested : detected
  const amountsCad = parseCadAmounts(req.nextUrl.searchParams)

  if (amountsCad.length === 0) {
    return NextResponse.json({ error: 'Provide amountCad or amountsCad query params' }, { status: 400 })
  }

  const quotes = await Promise.all(
    amountsCad.map(async (amountCad) => ({
      amountCad,
      amountLocal: await convertCadAmount(amountCad, currency),
    }))
  )

  return NextResponse.json({
    currency,
    quotes,
    note: 'Estimated local pricing. PayPal final charge can vary slightly due to FX updates.',
  })
}
