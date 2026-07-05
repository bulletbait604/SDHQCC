import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { buildBungieAuthorizeUrl } from '@/lib/destiny/bungieOAuth'
import { createBungieOAuthState } from '@/lib/destiny/bungieOAuthStateStore'
import { bungieOAuthConfigured, bungieOAuthRedirectUriFromRequest } from '@/lib/destiny/env'
import { defaultBungieReturnPath } from '@/lib/home/tabUrl'
import { sessionCookieSecure } from '@/lib/sessionCookie'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)

    if (!bungieOAuthConfigured()) {
      return NextResponse.json(
        {
          error:
            'Bungie OAuth is not configured. Set DESTINY_API, BUNGIE_OAUTH_CLIENT_ID, and BUNGIE_OAUTH_CLIENT_SECRET.',
        },
        { status: 503 }
      )
    }

    const redirectUri = bungieOAuthRedirectUriFromRequest(req)
    const returnParam = req.nextUrl.searchParams.get('return')
    const returnPath =
      returnParam && returnParam.startsWith('/') && !returnParam.startsWith('//')
        ? returnParam
        : defaultBungieReturnPath()

    const state = await createBungieOAuthState({
      userId: user.username,
      redirectUri,
      returnPath,
    })

    const url = buildBungieAuthorizeUrl(state, redirectUri)
    const secure = sessionCookieSecure(req)

    const res = NextResponse.redirect(url)
    // Cookie backup only — primary validation is MongoDB state record.
    res.cookies.set('bungieOAuthState', state, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      path: '/',
      maxAge: 600,
    })
    return res
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[destiny/auth/bungie/start]', error)
    return NextResponse.json({ error: 'Failed to start Bungie authorization' }, { status: 500 })
  }
}

export async function HEAD(req: NextRequest) {
  return NextResponse.json({ redirectUri: bungieOAuthRedirectUriFromRequest(req) })
}
