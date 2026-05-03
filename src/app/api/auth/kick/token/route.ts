import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { signSessionJwt, getSessionSecret } from '@/lib/auth/sessionJwt'
import type { UserRole } from '@/lib/auth/verifyAuth'
import { sessionCookieSecure } from '@/lib/sessionCookie'
import {
  normalizeKickUserRow,
  kickOAuthExtrasFromRow,
  type NormalizedKickUser,
} from '@/lib/kickUserProfile'
import {
  INTERNAL_API_SECRET_HEADER,
  getInternalApiSecret,
} from '@/lib/internalApi'

export async function POST(request: NextRequest) {
  try {
    const { code, codeVerifier } = await request.json()

    if (!code || !codeVerifier) {
      return NextResponse.json({ error: 'Authorization code and code verifier are required' }, { status: 400 })
    }

    const clientId = process.env.NEXT_PUBLIC_KICK_CLIENT_ID
    const clientSecret = process.env.KICK_CLIENT_SECRET
    const redirectUri = process.env.NEXT_PUBLIC_KICK_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json({ error: 'Missing KICK OAuth configuration' }, { status: 500 })
    }

    const tokenResponse = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('KICK token exchange failed:', errorData)
      return NextResponse.json({ error: 'Token exchange failed', details: errorData }, { status: 400 })
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      return NextResponse.json({ error: 'No access token received' }, { status: 400 })
    }

    const userResponse = await fetch('https://api.kick.com/public/v1/users', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    let user: NormalizedKickUser | null = null
    let kickRawRow: Record<string, unknown> | null = null

    if (userResponse.ok) {
      const userData = await userResponse.json()
      if (userData.data && userData.data.length > 0) {
        kickRawRow = userData.data[0] as Record<string, unknown>
        user = normalizeKickUserRow(kickRawRow)
      }
    }

    let roleForSession: UserRole = 'free'

    if (user) {
      console.log(`User login: ${user.username} (ID: ${user.id}) at ${new Date().toISOString()}`)

      try {
        const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        const secret = getInternalApiSecret()
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (secret) {
          headers[INTERNAL_API_SECRET_HEADER] = secret
        }
        if (secret) {
          await fetch(`${base.replace(/\/$/, '')}/api/activity-log`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              username: user.username,
              action: 'login',
            }),
          })
        }
      } catch (error) {
        console.error('Failed to log login to activity log:', error)
      }

      const mongoClient = await clientPromise
      const db = mongoClient.db('sdhq')
      const now = new Date().toISOString()

      const extras = kickRawRow ? kickOAuthExtrasFromRow(kickRawRow) : {}
      const kickOAuth: Record<string, unknown> = {
        provider: 'kick',
        lastSyncedAt: now,
        userId: String(user.id),
        loginUsername: user.username,
        displayName: user.display_name,
        profileImageUrl: user.profile_image_url ?? null,
        email: user.email ?? null,
      }
      if (Object.keys(extras).length > 0) {
        kickOAuth.extras = extras
      }

      await db.collection('users').updateOne(
        { username: user.username },
        {
          $set: {
            username: user.username,
            kickId: String(user.id),
            display_name: user.display_name,
            profile_image_url: user.profile_image_url,
            email: user.email,
            kickOAuth,
            updatedAt: now,
          },
          $setOnInsert: {
            role: 'free',
            createdAt: now,
          },
        },
        { upsert: true }
      )

      const dbUser = await db.collection('users').findOne({ username: user.username })
      roleForSession = (dbUser?.role as UserRole) || 'free'
    }

    if (!user) {
      return NextResponse.json(
        {
          error:
            'Kick API did not return your profile. Ensure the token scope includes user access, then try again.',
        },
        { status: 502 }
      )
    }

    const secret = getSessionSecret()
    if (!secret) {
      console.error('[Kick OAuth] SESSION_SECRET / JWT_SECRET missing — cannot issue session cookie')
      return NextResponse.json(
        {
          error:
            'Server is missing SESSION_SECRET (or JWT_SECRET). Set it in the deployment environment to enable login.',
        },
        { status: 503 }
      )
    }

    const jwt = signSessionJwt(
      {
        sub: String(user.id),
        name: user.username,
        role: roleForSession,
        provider: 'kick',
      },
      secret,
      60 * 60 * 24 * 30
    )

    const res = NextResponse.json({
      accessToken,
      refreshToken: tokenData.refresh_token,
      user,
    })

    res.cookies.set('session', jwt, {
      httpOnly: true,
      secure: sessionCookieSecure(request),
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })

    return res
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('KICK OAuth callback error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
