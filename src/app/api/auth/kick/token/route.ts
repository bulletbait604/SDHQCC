import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 })
    }

    const clientId = process.env.NEXT_PUBLIC_KICK_CLIENT_ID
    const clientSecret = process.env.KICK_CLIENT_SECRET
    const redirectUri = process.env.NEXT_PUBLIC_KICK_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json({ error: 'Missing KICK OAuth configuration' }, { status: 500 })
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://kick.com/api/oauth/token', {
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
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('KICK token exchange failed:', errorData)
      return NextResponse.json({ error: 'Token exchange failed' }, { status: 400 })
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      return NextResponse.json({ error: 'No access token received' }, { status: 400 })
    }

    // Fetch user data using the access token
    const userResponse = await fetch('https://api.kick.com/public/v1/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    let user = null
    if (userResponse.ok) {
      const userData = await userResponse.json()
      user = userData.data || userData
    }

    return NextResponse.json({
      accessToken: accessToken,
      refreshToken: tokenData.refresh_token,
      user: user,
    })
  } catch (error: any) {
    console.error('KICK OAuth callback error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
