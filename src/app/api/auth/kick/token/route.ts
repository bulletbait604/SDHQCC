import { NextRequest, NextResponse } from 'next/server'

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

    // Correct KICK token endpoint: https://id.kick.com/oauth/token
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

    // Fetch user data using the access token - correct endpoint is /users (not /user)
    const userResponse = await fetch('https://api.kick.com/public/v1/users', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    let user = null
    if (userResponse.ok) {
      const userData = await userResponse.json()
      // Kick returns { data: [ { user_id, name, email, profile_picture } ] }
      if (userData.data && userData.data.length > 0) {
        const kickUser = userData.data[0]
        // Map Kick fields to our interface
        user = {
          id: kickUser.user_id,
          username: kickUser.name,
          display_name: kickUser.name,
          profile_image_url: kickUser.profile_picture,
          email: kickUser.email
        }
      }
    }

    // Log the login
    if (user) {
      console.log(`User login: ${user.username} (ID: ${user.id}) at ${new Date().toISOString()}`)
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
