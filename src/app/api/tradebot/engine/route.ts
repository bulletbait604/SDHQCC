import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { setPaperEngine } from '@/lib/tradebot/ledger'
import { isTradebotPaperEnabled } from '@/lib/tradebot/settings'

export const dynamic = 'force-dynamic'

/** Owner-only: turn the paper desk on or off. Never hits a live broker. */
export async function POST(req: NextRequest) {
  try {
    await verifyOwnerUser(req)
    if (!isTradebotPaperEnabled()) {
      return NextResponse.json(
        { error: 'TRADEBOT_PAPER must be true.', engineOn: false },
        { status: 503 }
      )
    }
    const body = (await req.json().catch(() => ({}))) as { on?: unknown }
    const ledger = await setPaperEngine(Boolean(body.on))
    return NextResponse.json({ engineOn: ledger.engineOn, ledger })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[tradebot/engine]', err)
    return NextResponse.json({ error: 'Could not change ON/OFF.' }, { status: 503 })
  }
}

