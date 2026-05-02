import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { signSessionJwt, getSessionSecret } from '@/lib/auth/sessionJwt'
import type { UserRole } from '@/lib/auth/verifyAuth'

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

    let user: {
      id: number | string
      username: string
      display_name: string
      profile_image_url?: string
      email?: string
    } | null = null

    if (userResponse.ok) {
      const userData = await userResponse.json()
      if (userData.data && userData.data.length > 0) {
        const kickUser = userData.data[0]
        const pic =
          kickUser.profile_picture ||
          kickUser.profile_picture_url ||
          kickUser.avatar ||
          undefined
        const name = kickUser.name || kickUser.username || ''
        user = {
          id: kickUser.user_id,
          username: String(name).replace(/^@/, '').toLowerCase(),
          display_name: name,
          profile_image_url: pic,
          email: kickUser.email,
        }
      }
    }

    let roleForSession: UserRole = 'free'

    if (user) {
      console.log(`User login: ${user.username} (ID: ${user.id}) at ${new Date().toISOString()}`)

      try {
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/activity-log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: user.username,
            action: 'login',
          }),
        })
      } catch (error) {
        console.error('Failed to log login to activity log:', error)
      }

      const mongoClient = await clientPromise
      const db = mongoClient.db('sdhq')
      const now = new Date().toISOString()

      await db.collection('users').updateOne(
        { username: user.username },
        {
          $set: {
            username: user.username,
            kickId: String(user.id),
            profile_image_url: user.profile_image_url,
            email: user.email,
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

    const res = NextResponse.json({
      accessToken,
      refreshToken: tokenData.refresh_token,
      user,
    })

    if (user) {
      const secret = getSessionSecret()
      if (secret) {
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
        const secure = process.env.NODE_ENV === 'production'
        res.cookies.set('session', jwt, {
          httpOnly: true,
          secure: secure,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
        })
      } else {
        console.error(
          '[Kick OAuth] SESSION_SECRET / JWT_SECRET missing — authenticated APIs (coins, admin) will return 401'
        )
      }
    }

    return res
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('KICK OAuth callback error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
