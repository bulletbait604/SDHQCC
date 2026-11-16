import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { signSessionJwt, getSessionSecret } from '@/lib/auth/sessionJwt'
import type { UserRole } from '@/lib/auth/verifyAuth'
import { sessionCookieSecure } from '@/lib/sessionCookie'
import { BANNED_USER_MESSAGE, isUserBanned } from '@/lib/bannedUsers'
import { resolveSiteRole } from '@/lib/home/ownerIdentity'
import { twitchClientId } from '@/lib/twitch/oauth'
import { consumeTwitchOAuthState } from '@/lib/twitch/stateStore'
import { saveTwitchTokens } from '@/lib/twitch/tokens'
import { readTwitchProfile, twitchAccountUsername } from '@/lib/twitch/mapChannel'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { code?: unknown; state?: unknown }
    const code = typeof body.code === 'string' ? body.code : ''
    const state = typeof body.state === 'string' ? body.state : ''
    if (!code || !state) {
      return NextResponse.json({ error: 'Missing Twitch authorization code.' }, { status: 400 })
    }

    const saved = await consumeTwitchOAuthState(state)
    if (!saved) {
      return NextResponse.json({ error: 'Twitch login expired. Please try again.' }, { status: 400 })
    }

    const clientId = twitchClientId()
    const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim()
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Twitch login is not configured.' }, { status: 404 })
    }

    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: saved.redirectUri,
      }),
    })
    if (!tokenResponse.ok) {
      return NextResponse.json({ error: 'Twitch did not accept that login.' }, { status: 400 })
    }
    const tokenBody = (await tokenResponse.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      scope?: string | string[]
    }
    if (!tokenBody.access_token || !tokenBody.refresh_token) {
      return NextResponse.json({ error: 'Twitch did not return a session.' }, { status: 400 })
    }

    const userResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`,
        'Client-Id': clientId,
      },
    })
    const profile = readTwitchProfile(await userResponse.json().catch(() => null))
    if (!userResponse.ok || !profile) {
      return NextResponse.json({ error: 'Twitch did not return your profile.' }, { status: 502 })
    }

    const account = twitchAccountUsername(profile.id)
    if (await isUserBanned(account)) {
      return NextResponse.json({ error: BANNED_USER_MESSAGE, banned: true }, { status: 403 })
    }

    const scope = Array.isArray(tokenBody.scope) ? tokenBody.scope.join(' ') : tokenBody.scope || ''
    await saveTwitchTokens({
      twitchId: profile.id,
      accessToken: tokenBody.access_token,
      refreshToken: tokenBody.refresh_token,
      expiresIn: typeof tokenBody.expires_in === 'number' ? tokenBody.expires_in : 3600,
      scope,
    })

    const now = new Date().toISOString()
    const mongo = await clientPromise
    const users = mongo.db('sdhq').collection('users')
    await users.updateOne(
      { twitchId: profile.id },
      {
        $set: {
          username: account,
          provider: 'twitch',
          providerUserId: profile.id,
          twitchId: profile.id,
          twitchLogin: profile.login,
          display_name: profile.displayName,
          profile_image_url: profile.profileImageUrl,
          email: profile.email,
          updatedAt: now,
        },
        $setOnInsert: {
          role: 'free',
          createdAt: now,
        },
      },
      { upsert: true }
    )

    const dbUser = await users.findOne({ twitchId: profile.id })
    const role = resolveSiteRole(account, (dbUser?.role as UserRole) || 'free', 'twitch')
    if (dbUser?.role !== role) {
      await users.updateOne({ twitchId: profile.id }, { $set: { role, updatedAt: now } })
    }

    const secret = getSessionSecret()
    if (!secret) {
      return NextResponse.json({ error: 'Server is missing SESSION_SECRET.' }, { status: 503 })
    }
    const jwt = signSessionJwt(
      {
        sub: profile.id,
        name: account,
        role,
        provider: 'twitch',
      },
      secret,
      60 * 60 * 24 * 30
    )

    const res = NextResponse.json({
      user: {
        id: profile.id,
        username: account,
        display_name: profile.displayName,
        provider: 'twitch',
      },
      returnPath: saved.returnPath,
    })
    res.cookies.set('session', jwt, {
      httpOnly: true,
      secure: sessionCookieSecure(request),
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return res
  } catch (error) {
    console.error('[auth/twitch/token]', error instanceof Error ? error.message : 'failed')
    return NextResponse.json({ error: 'Could not finish Twitch login.' }, { status: 500 })
  }
}
