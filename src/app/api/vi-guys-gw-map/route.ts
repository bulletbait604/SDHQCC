import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse, verifyAuth } from '@/lib/auth/verifyAuth'
import { Gw2ApiError } from '@/lib/gw2/client'
import { resolveGw2KeyForUser } from '@/lib/gw2/resolveKey'
import { loadHeroPointTracker } from '@/lib/gw2/tracker'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/** Any Kick-signed-in user: Tyria hero challenges + that user's stored GW2 API key. */
export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const resolved = await resolveGw2KeyForUser(user)
    const payload = await loadHeroPointTracker(resolved.key, resolved.source)
    return NextResponse.json({ ...payload, linkedKey: resolved.linkedKey })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[vi-guys-gw-map]', err)
    const message = err instanceof Error ? err.message : 'GW2 map failed'
    const status = err instanceof Gw2ApiError && err.status === 401 ? 502 : 503
    return NextResponse.json(
      {
        error: message,
        userMessage:
          err instanceof Gw2ApiError && err.status === 401
            ? 'GW2 rejected this ArenaNet API key. Paste a new key with account, characters, and progression scopes.'
            : 'Could not load the Guild Wars 2 map. Retry in a moment.',
      },
      { status }
    )
  }
}
