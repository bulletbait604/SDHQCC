import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { runPaperTick } from '@/lib/tradebot/liveTape'
import { isTradebotPaperEnabled } from '@/lib/tradebot/settings'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Owner-only: watch live CAD crypto prints and paper-trade. Never hits a live broker. */
export async function POST(req: NextRequest) {
  try {
    await verifyOwnerUser(req)
    if (!isTradebotPaperEnabled()) {
      return NextResponse.json(
        {
          error: 'TRADEBOT_PAPER must be true. Live brokers are disabled.',
          userMessage: 'Set TRADEBOT_PAPER=true and redeploy. Live trading is off.',
        },
        { status: 503 }
      )
    }
    const result = await runPaperTick()
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
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
}
