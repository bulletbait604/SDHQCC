import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { isValidCronRequest, isValidInternalApiSecret, INTERNAL_API_SECRET_HEADER } from '@/lib/internalApi'
import { runPaperTick } from '@/lib/tradebot/liveTape'
import { isTradebotDeskEnabled } from '@/lib/tradebot/settings'

export const dynamic = 'force-dynamic'
export const maxDuration = 55

async function runTick(): Promise<Response> {
  if (!isTradebotDeskEnabled()) {
    return NextResponse.json(
      {
        error: 'Desk is not enabled.',
        userMessage: 'Set TRADEBOT_PAPER=true for fake money, or TRADEBOT_LIVE=true with Kraken keys.',
      },
      { status: 503 }
    )
  }
  const result = await runPaperTick()
  return NextResponse.json(result)
}

function failTick(err: unknown) {
  console.error('[tradebot/tick]', err)
  const message = err instanceof Error ? err.message : 'Live watch failed'
  return NextResponse.json(
    {
      error: message,
      userMessage: 'Could not watch live prices. Try again in a few seconds.',
    },
    { status: 503 }
  )
}

/** Vercel Cron / internal: 8s-style Kraken tick even when the TradeBot tab is closed. */
export async function GET(req: NextRequest) {
  try {
    if (isValidCronRequest(req) || isValidInternalApiSecret(req.headers.get(INTERNAL_API_SECRET_HEADER))) {
      return await runTick()
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    return failTick(err)
  }
}

/** Owner-only: live Kraken CAD quotes. Trades only when the desk is ON (paper or live keys). */
export async function POST(req: NextRequest) {
  try {
    await verifyOwnerUser(req)
    return await runTick()
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    return failTick(err)
  }
}
