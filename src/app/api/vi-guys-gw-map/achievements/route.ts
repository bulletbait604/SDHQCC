import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse, verifyAuth } from '@/lib/auth/verifyAuth'
import { loadAchievementTracker } from '@/lib/gw2/achievements'
import { resolveGw2KeyForUser } from '@/lib/gw2/resolveKey'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    let key: string | null = null
    try {
      key = (await resolveGw2KeyForUser(user)).key
    } catch (err) {
      console.error('[vi-guys-gw-map/achievements] stored key lookup failed; serving catalog only', err)
    }
    const payload = await loadAchievementTracker(key)
    return NextResponse.json(payload)
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[vi-guys-gw-map/achievements]', err)
    const message = err instanceof Error ? err.message : 'GW2 achievements failed'
    return NextResponse.json(
      {
        error: message,
        userMessage: 'Could not load Guild Wars 2 achievements. Retry in a moment.',
      },
      { status: 503 }
    )
  }
}
