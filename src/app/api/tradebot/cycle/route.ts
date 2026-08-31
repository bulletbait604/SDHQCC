import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { isValidCronRequest, isValidInternalApiSecret, INTERNAL_API_SECRET_HEADER } from '@/lib/internalApi'
import { loadPaperLedger } from '@/lib/tradebot/ledger'
import { runPaperCycle } from '@/lib/tradebot/graph'
import { isTradebotPaperEnabled } from '@/lib/tradebot/settings'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function runCycle(): Promise<Response> {
  if (!isTradebotPaperEnabled()) {
    return NextResponse.json(
      {
        error: 'TRADEBOT_PAPER must be true. Live brokers are disabled.',
        userMessage: 'Set TRADEBOT_PAPER=true and redeploy. Live trading is off.',
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
      userMessage: message.includes('TRADEBOT_PAPER')
        ? 'Set TRADEBOT_PAPER=true and redeploy. Live trading is off.'
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

/** Owner-only R&D: one Canada CAD paper cycle. Never hits a live broker. */
export async function POST(req: NextRequest) {
  try {
    await verifyOwnerUser(req)
    return await runCycle()
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    return failCycle(err)
  }
}
