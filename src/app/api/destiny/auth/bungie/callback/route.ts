import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, AuthError } from '@/lib/auth/verifyAuth'
import { attachSessionCookieForUsername } from '@/lib/auth/issueSession'
import {
  exchangeBungieAuthorizationCode,
  fetchLinkedGuardianSummary,
  formatBungieDisplayName,
  getDestinyMembershipsForCurrentUser,
  pickPrimaryDestinyMembership,
  platformFromMembershipType,
} from '@/lib/destiny/bungieOAuth'
import { consumeBungieOAuthState } from '@/lib/destiny/bungieOAuthStateStore'
import { upsertDestinyUser } from '@/lib/destiny/destinyUserStore'
import { bungieOAuthRedirectUriFromRequest } from '@/lib/destiny/env'
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
  const secure = sessionCookieSecure(req)
  res.cookies.set('bungieOAuthState', '', { httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', path: '/', maxAge: 0 })
  return res
}

export async function GET(req: NextRequest) {
  let returnPath: string | undefined

  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    const stateRecord = state ? await consumeBungieOAuthState(state) : null
    returnPath = stateRecord?.returnPath

    if (error) {
      return redirectAfterOAuth({ bungie: 'error', message: error }, req, returnPath)
    }

    if (!code || !state) {
      return redirectAfterOAuth({ bungie: 'error', message: 'missing_code' }, req, returnPath)
    }

    if (!stateRecord) {
      const cookieState = req.cookies.get('bungieOAuthState')?.value
      if (!cookieState || cookieState !== state) {
        return redirectAfterOAuth({ bungie: 'error', message: 'invalid_state' }, req, returnPath)
      }
      return redirectAfterOAuth({ bungie: 'error', message: 'invalid_state' }, req, returnPath)
    }

    const siteUserId = stateRecord.userId
    let sessionMatches = false

    try {
      const sessionUser = await verifyAuth(req)
      sessionMatches = sessionUser.username.toLowerCase() === siteUserId
      if (!sessionMatches) {
        return redirectAfterOAuth({ bungie: 'error', message: 'invalid_state' }, req, returnPath)
      }
    } catch (authError) {
      if (!(authError instanceof AuthError)) throw authError
      // Session cookie often drops during the Bungie redirect — use stored OAuth state userId.
    }

    const redirectUri =
      stateRecord.redirectUri ||
      req.cookies.get('bungieOAuthRedirect')?.value ||
      bungieOAuthRedirectUriFromRequest(req)

    const tokens = await exchangeBungieAuthorizationCode(code, redirectUri)
    const memberships = await getDestinyMembershipsForCurrentUser(tokens.accessToken)
    const primary = pickPrimaryDestinyMembership(
      memberships.destinyMemberships ?? [],
      memberships.primaryMembershipId
    )

    if (!primary) {
      return redirectAfterOAuth({ bungie: 'error', message: 'no_destiny_account' }, req, returnPath)
    }

    let summary: Awaited<ReturnType<typeof fetchLinkedGuardianSummary>> | undefined
    try {
      summary = await fetchLinkedGuardianSummary(
        primary.membershipType,
        primary.membershipId,
        tokens.accessToken
      )
    } catch (summaryError) {
      console.warn('[destiny/auth/bungie/callback] Guardian summary fetch failed:', summaryError)
    }

    const displayName = formatBungieDisplayName(primary)

    await upsertDestinyUser(siteUserId, {
      bungieMembershipId: primary.membershipId,
      bungieNetMembershipId: tokens.membershipId,
      destinyMembershipType: primary.membershipType,
      bungieDisplayName: displayName,
      platform: platformFromMembershipType(primary.membershipType) as 'steam' | 'xbox' | 'playstation' | 'epic',
      emblemUrl: summary?.emblemUrl,
      powerLevel: summary?.powerLevel,
      characterClass: summary?.characterClass,
      guardianRank: undefined,
      connectedAt: new Date().toISOString(),
      oauth: tokens,
    })

    const res = redirectAfterOAuth({ bungie: 'linked' }, req, returnPath)

    if (!sessionMatches) {
      await attachSessionCookieForUsername(siteUserId, req, res)
    }

    return res
  } catch (error) {
    console.error('[destiny/auth/bungie/callback]', error)
    const detail = error instanceof Error ? error.message : 'exchange_failed'
    const lower = detail.toLowerCase()
    const message =
      lower.includes('redirect_uri') || lower.includes('redirect uri')
        ? 'redirect_uri_mismatch'
        : detail.slice(0, 180)
    return redirectAfterOAuth({ bungie: 'error', message }, req, returnPath)
  }
}
