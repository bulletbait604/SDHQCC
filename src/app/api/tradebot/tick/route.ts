import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { runPaperTick } from '@/lib/tradebot/liveTape'
import { isTradebotDeskEnabled } from '@/lib/tradebot/settings'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Owner-only: live Kraken CAD quotes. Trades only when the desk is ON (paper or live keys). */
export async function POST(req: NextRequest) {
  try {
    await verifyOwnerUser(req)
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
