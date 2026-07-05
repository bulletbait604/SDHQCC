import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import {
  getDestinyUserBySiteUserId,
  getValidAccessToken,
} from '@/lib/destiny/destinyUserStore'
import { bungieOAuthConfigured, bungieOAuthRedirectUriFromRequest } from '@/lib/destiny/env'

export const dynamic = 'force-dynamic'

function isBungieLinked(stored: Awaited<ReturnType<typeof getDestinyUserBySiteUserId>>): boolean {
  if (!stored) return false
  const hasMembership =
    Boolean(stored.bungieMembershipId) && String(stored.bungieMembershipId).length > 0
  const hasOAuth = Boolean(stored.oauth?.accessToken || stored.oauth?.refreshToken)
  return hasMembership || hasOAuth
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    let stored = await getDestinyUserBySiteUserId(user.username.toLowerCase())
    const linked = isBungieLinked(stored)

    let tokenHealthy = false
    if (stored?.oauth) {
      tokenHealthy = Boolean(await getValidAccessToken(stored))
      stored = (await getDestinyUserBySiteUserId(user.username.toLowerCase())) ?? stored
    }

    return NextResponse.json({
      configured: bungieOAuthConfigured(),
      redirectUri: bungieOAuthRedirectUriFromRequest(req),
      linked,
      tokenHealthy,
      needsReconnect: linked && !tokenHealthy,
      bungieDisplayName: stored?.bungieDisplayName,
      platform: stored?.platform,
      connectedAt: stored?.connectedAt,
      emblemUrl: stored?.emblemUrl,
      powerLevel: stored?.powerLevel,
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    return NextResponse.json({ error: 'Failed to read Bungie link status' }, { status: 500 })
  }
}
