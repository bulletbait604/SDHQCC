import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import {
  exchangeBungieAuthorizationCode,
  fetchLinkedGuardianSummary,
  formatBungieDisplayName,
  getDestinyMembershipsForCurrentUser,
  pickPrimaryDestinyMembership,
  platformFromMembershipType,
} from '@/lib/destiny/bungieOAuth'
import { upsertDestinyUser } from '@/lib/destiny/destinyUserStore'
import { sessionCookieSecure } from '@/lib/sessionCookie'

export const dynamic = 'force-dynamic'

function redirectHome(params: Record<string, string>, req: NextRequest): NextResponse {
  const base = new URL('/', req.url)
  for (const [k, v] of Object.entries(params)) {
    base.searchParams.set(k, v)
  }
  const res = NextResponse.redirect(base)
  res.cookies.set('bungieOAuthState', '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return redirectHome({ tab: 'destiny-top-nest', bungie: 'error', message: error }, req)
    }

    if (!code || !state) {
      return redirectHome({ tab: 'destiny-top-nest', bungie: 'error', message: 'missing_code' }, req)
    }

    const cookieState = req.cookies.get('bungieOAuthState')?.value
    if (!cookieState || cookieState !== state) {
      return redirectHome({ tab: 'destiny-top-nest', bungie: 'error', message: 'invalid_state' }, req)
    }

    const tokens = await exchangeBungieAuthorizationCode(code)
    const memberships = await getDestinyMembershipsForCurrentUser(tokens.accessToken)
    const primary = pickPrimaryDestinyMembership(
      memberships.destinyMemberships ?? [],
      memberships.primaryMembershipId
        ? Number(memberships.primaryMembershipId)
        : undefined
    )

    if (!primary) {
      return redirectHome({ tab: 'destiny-top-nest', bungie: 'error', message: 'no_destiny_account' }, req)
    }

    const summary = await fetchLinkedGuardianSummary(
      primary.membershipType,
      primary.membershipId,
      tokens.accessToken
    )

    const displayName = formatBungieDisplayName(primary)

    await upsertDestinyUser(user.username.toLowerCase(), {
      bungieMembershipId: primary.membershipId,
      bungieNetMembershipId: tokens.membershipId,
      bungieDisplayName: displayName,
      platform: platformFromMembershipType(primary.membershipType) as 'steam' | 'xbox' | 'playstation' | 'epic',
      emblemUrl: summary.emblemUrl,
      powerLevel: summary.powerLevel,
      characterClass: summary.characterClass,
      guardianRank: undefined,
      connectedAt: new Date().toISOString(),
      oauth: tokens,
    })

    const res = redirectHome({ tab: 'destiny-top-nest', bungie: 'linked' }, req)
    res.cookies.set('bungieOAuthState', '', {
      httpOnly: true,
      secure: sessionCookieSecure(),
      path: '/',
      maxAge: 0,
    })
    return res
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[destiny/auth/bungie/callback]', error)
    return redirectHome({ tab: 'destiny-top-nest', bungie: 'error', message: 'exchange_failed' }, req)
  }
}
