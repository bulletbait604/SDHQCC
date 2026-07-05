import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { getDestinyUserBySiteUserId } from '@/lib/destiny/destinyUserStore'
import { bungieOAuthConfigured, bungieOAuthRedirectUriFromRequest } from '@/lib/destiny/env'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const stored = await getDestinyUserBySiteUserId(user.username.toLowerCase())

    return NextResponse.json({
      configured: bungieOAuthConfigured(),
      redirectUri: bungieOAuthRedirectUriFromRequest(req),
      linked: Boolean(stored?.bungieMembershipId),
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
