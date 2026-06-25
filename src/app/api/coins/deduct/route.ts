import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, AuthError } from '@/lib/auth/verifyAuth'
import { TOOL_COIN_COSTS } from '@/lib/coins/toolCosts'
import { spendToolCoins } from '@/lib/coins/spendToolCoins'

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const body = await req.json()
    const { tool } = body

    if (!tool || typeof tool !== 'string') {
      return NextResponse.json({ error: 'Tool name required' }, { status: 400 })
    }

    if (!(tool in TOOL_COIN_COSTS)) {
      return NextResponse.json(
        { error: 'Invalid tool', validTools: Object.keys(TOOL_COIN_COSTS) },
        { status: 400 }
      )
    }

    const spend = await spendToolCoins(user, tool as keyof typeof TOOL_COIN_COSTS)
    if (!spend.ok) {
      return NextResponse.json(
        { error: spend.reason, required: spend.required, available: spend.available, tool },
        { status: spend.status }
      )
    }

    return NextResponse.json({
      success: true,
      remainingCoins: spend.remainingCoins,
      deducted: spend.deducted,
      tool,
      unlimited: spend.unlimited,
    })
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[Coins] Deduct error:', error)
    return NextResponse.json({ error: 'Failed to deduct coins' }, { status: 500 })
  }
}
