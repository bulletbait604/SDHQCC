import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { setDeskControls } from '@/lib/tradebot/ledger'
import { isKrakenLiveAllowed, isPlacingLiveOrders, isTradebotDeskEnabled } from '@/lib/tradebot/settings'
import { syncLiveCash } from '@/lib/tradebot/venue'

export const dynamic = 'force-dynamic'

/** Owner-only: ON/OFF and Fake/Real money. Live Kraken orders only when Real is selected. */
export async function POST(req: NextRequest) {
  try {
    await verifyOwnerUser(req)
    if (!isTradebotDeskEnabled()) {
      return NextResponse.json(
        { error: 'Set TRADEBOT_PAPER=true or add Kraken keys.', engineOn: false },
        { status: 503 }
      )
    }
    const body = (await req.json().catch(() => ({}))) as { on?: unknown; liveMode?: unknown; volatility?: unknown }
    const patch: { on?: boolean; liveMode?: boolean; volatility?: 'low' | 'medium' | 'high' } = {}
    if (typeof body.on === 'boolean') patch.on = body.on
    if (typeof body.liveMode === 'boolean') patch.liveMode = body.liveMode
    if (typeof body.volatility === 'string') {
      const v = body.volatility.trim().toLowerCase()
      if (v === 'low' || v === 'medium' || v === 'high') patch.volatility = v
    }
    let ledger = await setDeskControls(patch)
    let syncError: string | undefined
    if (ledger.liveMode) {
      try {
        ledger = await syncLiveCash(ledger)
      } catch (err) {
        console.error('[tradebot/engine] Kraken CAD', err)
        syncError = err instanceof Error ? err.message : 'Could not read Kraken CAD.'
      }
    }
    return NextResponse.json({
      engineOn: ledger.engineOn,
      liveMode: ledger.liveMode,
      volatility: ledger.volatility,
      krakenLive: isPlacingLiveOrders(ledger),
      liveAllowed: isKrakenLiveAllowed(),
      ledger,
      equity: Number(ledger.cash.toFixed(2)),
      error: syncError,
    })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[tradebot/engine]', err)
    const message = err instanceof Error ? err.message : 'Could not change ON/OFF.'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
