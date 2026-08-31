import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { runPaperCycle } from '@/lib/tradebot/graph'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Owner-only R&D: one Canada CAD paper cycle. Never hits a live broker. */
export async function POST(req: NextRequest) {
  try {
    await verifyOwnerUser(req)
    const result = await runPaperCycle()
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[tradebot/cycle]', err)
    const message = err instanceof Error ? err.message : 'Cycle failed'
    return NextResponse.json(
      {
        error: message,
        userMessage: message.includes('TRADEBOT_PAPER')
          ? 'Set TRADEBOT_PAPER=true and redeploy. Live trading is off.'
          : 'Paper cycle failed. Check Gemini and quote sources, then retry.',
      },
      { status: 503 }
    )
  }
}
