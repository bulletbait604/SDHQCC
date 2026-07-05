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
import { defaultBungieReturnPath } from '@/lib/home/tabUrl'
import { sessionCookieSecure } from '@/lib/sessionCookie'

export const dynamic = 'force-dynamic'

function redirectAfterOAuth(
  params: Record<string, string>,
  req: NextRequest,
  returnPath?: string
): NextResponse {
  const safeReturn =
    returnPath && returnPath.startsWith('/') && !returnPath.startsWith('//')
      ? returnPath
      : defaultBungieReturnPath()

  const target = new URL(safeReturn, req.url)
  for (const [k, v] of Object.entries(params)) {
    target.searchParams.set(k, v)
  }

  const res = NextResponse.redirect(target)
  res.cookies.set('bungieOAuthState', '', { httpOnly: true, path: '/', maxAge: 0 })
  res.cookies.set('bungieOAuthReturn', '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}

export async function GET(req: NextRequest) {
  const returnPath = req.cookies.get('bungieOAuthReturn')?.value

  try {
    const user = await verifyAuth(req)
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return redirectAfterOAuth({ bungie: 'error', message: error }, req, returnPath)
    }

    if (!code || !state) {
      return redirectAfterOAuth({ bungie: 'error', message: 'missing_code' }, req, returnPath)
    }

    const cookieState = req.cookies.get('bungieOAuthState')?.value
    if (!cookieState || cookieState !== state) {
      return redirectAfterOAuth({ bungie: 'error', message: 'invalid_state' }, req, returnPath)
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
      return redirectAfterOAuth({ bungie: 'error', message: 'no_destiny_account' }, req, returnPath)
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

    return redirectAfterOAuth({ bungie: 'linked' }, req, returnPath)
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[destiny/auth/bungie/callback]', error)
    return redirectAfterOAuth({ bungie: 'error', message: 'exchange_failed' }, req, returnPath)
  }
}
