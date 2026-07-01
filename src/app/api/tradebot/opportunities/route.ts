import { NextRequest, NextResponse } from 'next/server'
import { verifyStaffUser } from '@/lib/auth/staffAccess'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { readTradebotSnapshot } from '@/lib/tradebot/store'
import { runTradebotScan } from '@/lib/tradebot/runScan'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    await verifyStaffUser(request)
    const snapshot = await readTradebotSnapshot()
    return NextResponse.json({ snapshot })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[tradebot/opportunities GET]', error)
    return NextResponse.json({ error: 'Failed to load opportunities' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await verifyStaffUser(request)
    const snapshot = await runTradebotScan()
    return NextResponse.json({ snapshot })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[tradebot/opportunities POST]', error)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}
