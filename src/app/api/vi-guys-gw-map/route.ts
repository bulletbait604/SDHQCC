import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse, verifyAuth } from '@/lib/auth/verifyAuth'
import { resolveGw2KeyForUser } from '@/lib/gw2/resolveKey'
import { loadHeroPointTracker } from '@/lib/gw2/tracker'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/** Any Kick-signed-in user: Tyria hero challenges + that user's stored GW2 API key. */
export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    let resolved: Awaited<ReturnType<typeof resolveGw2KeyForUser>> = {
      key: null,
      source: 'none',
      linkedKey: null,
    }
    try {
      resolved = await resolveGw2KeyForUser(user)
    } catch (err) {
      console.error('[vi-guys-gw-map] stored key lookup failed; serving public map', err)
    }
    const payload = await loadHeroPointTracker(resolved.key, resolved.source)
    return NextResponse.json({ ...payload, linkedKey: resolved.linkedKey })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[vi-guys-gw-map]', err)
    const message = err instanceof Error ? err.message : 'GW2 map failed'
    return NextResponse.json(
      {
        error: message,
        userMessage: 'Could not load the Guild Wars 2 map. Retry in a moment.',
      },
      { status: 503 }
    )
  }
}
