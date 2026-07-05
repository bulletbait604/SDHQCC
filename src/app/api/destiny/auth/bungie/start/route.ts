import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { buildBungieAuthorizeUrl } from '@/lib/destiny/bungieOAuth'
import { bungieOAuthConfigured, bungieOAuthRedirectUriFromRequest } from '@/lib/destiny/env'
import { defaultBungieReturnPath } from '@/lib/home/tabUrl'
import { sessionCookieSecure } from '@/lib/sessionCookie'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await verifyAuth(req)

    if (!bungieOAuthConfigured()) {
      return NextResponse.json(
        {
          error:
            'Bungie OAuth is not configured. Set DESTINY_API, BUNGIE_OAUTH_CLIENT_ID, and BUNGIE_OAUTH_CLIENT_SECRET.',
        },
        { status: 503 }
      )
    }

    const state = randomBytes(24).toString('hex')
    const redirectUri = bungieOAuthRedirectUriFromRequest(req)
    const url = buildBungieAuthorizeUrl(state, redirectUri)
    const secure = sessionCookieSecure(req)
    const returnParam = req.nextUrl.searchParams.get('return')
    const returnPath =
      returnParam && returnParam.startsWith('/') && !returnParam.startsWith('//')
        ? returnParam
        : defaultBungieReturnPath()

    const res = NextResponse.redirect(url)
    res.cookies.set('bungieOAuthState', state, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    })
    res.cookies.set('bungieOAuthRedirect', redirectUri, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    })
    res.cookies.set('bungieOAuthReturn', returnPath, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
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
