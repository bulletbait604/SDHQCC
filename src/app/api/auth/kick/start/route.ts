import { NextRequest, NextResponse } from 'next/server'
import { createKickAuthURL } from '@/lib/kick-oauth'
import { createKickOAuthState } from '@/lib/kick/kickOAuthStateStore'

export const dynamic = 'force-dynamic'

function kickRedirectUri(req: NextRequest): string {
  const explicit = process.env.NEXT_PUBLIC_KICK_REDIRECT_URI?.trim()
  if (explicit) return explicit
  return `${new URL(req.url).origin}/auth/kick/callback`
}

export async function GET(req: NextRequest) {
  try {
    const redirectUri = kickRedirectUri(req)
    const returnParam = req.nextUrl.searchParams.get('return')
    const returnPath =
      returnParam && returnParam.startsWith('/') && !returnParam.startsWith('//') ? returnParam : '/'

    const { url, state, codeVerifier } = await createKickAuthURL(redirectUri)

    await createKickOAuthState({
      state,
      codeVerifier,
      redirectUri,
      returnPath,
    })

    return NextResponse.redirect(url)
  } catch (error) {
    console.error('[auth/kick/start]', error)
    return NextResponse.json({ error: 'Failed to start Kick authorization' }, { status: 500 })
  }
}
