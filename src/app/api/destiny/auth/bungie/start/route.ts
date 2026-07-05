import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { buildBungieAuthorizeUrl } from '@/lib/destiny/bungieOAuth'
import { bungieOAuthConfigured, bungieOAuthRedirectUri } from '@/lib/destiny/env'
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
    const url = buildBungieAuthorizeUrl(state)
    const secure = sessionCookieSecure()

    const res = NextResponse.redirect(url)
    res.cookies.set('bungieOAuthState', state, {
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

export async function HEAD() {
  return NextResponse.json({ redirectUri: bungieOAuthRedirectUri() })
}
