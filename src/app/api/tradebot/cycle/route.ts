import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { isValidCronRequest, isValidInternalApiSecret, INTERNAL_API_SECRET_HEADER } from '@/lib/internalApi'
import { loadPaperLedger } from '@/lib/tradebot/ledger'
import { runPaperCycle } from '@/lib/tradebot/graph'
import { isTradebotDeskEnabled } from '@/lib/tradebot/settings'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function runCycle(): Promise<Response> {
  if (!isTradebotDeskEnabled()) {
    return NextResponse.json(
      {
        error: 'Desk is not enabled.',
        userMessage: 'Set TRADEBOT_PAPER=true for fake money, or TRADEBOT_LIVE=true with Kraken keys.',
      },
      { status: 503 }
    )
  }
  const ledger = await loadPaperLedger()
  if (!ledger.engineOn) {
    return NextResponse.json({
      skipped: true,
      engineOn: false,
      userMessage: 'TradeBot is OFF. Turn it ON to run.',
    })
  }
  const result = await runPaperCycle()
  return NextResponse.json(result)
}

function failCycle(err: unknown) {
  console.error('[tradebot/cycle]', err)
  const message = err instanceof Error ? err.message : 'Cycle failed'
  return NextResponse.json(
    {
      error: message,
      userMessage: message.includes('TRADEBOT_PAPER') || message.includes('TRADEBOT_LIVE')
        ? 'Set TRADEBOT_PAPER=true for fake money, or TRADEBOT_LIVE=true with Kraken keys.'
        : message.includes('OFF')
          ? 'Turn the system ON first.'
          : 'Paper cycle failed. Check Gemini and quote sources, then retry.',
    },
    { status: 503 }
  )
}

/** Vercel Cron / internal: paper CAD cycle toward at least +8% today, ceiling +200%. */
export async function GET(req: NextRequest) {
  try {
    if (isValidCronRequest(req) || isValidInternalApiSecret(req.headers.get(INTERNAL_API_SECRET_HEADER))) {
      return await runCycle()
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    return failCycle(err)
  }
}

/** Owner-only R&D: one Canada CAD Gemini cycle. Live Kraken only when TRADEBOT_LIVE is set. */
export async function POST(req: NextRequest) {
  try {
    await verifyOwnerUser(req)
    return await runCycle()
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    return failCycle(err)
  }
}
