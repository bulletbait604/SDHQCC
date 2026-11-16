import { NextRequest, NextResponse } from 'next/server'
import { buildTwitchAuthorizeUrl, safeReturnPath, twitchClientId, twitchRedirectUri } from '@/lib/twitch/oauth'
import { createOAuthState, createTwitchOAuthState } from '@/lib/twitch/stateStore'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const clientId = twitchClientId()
  if (!clientId) {
    return NextResponse.json({ error: 'Twitch login is not configured.' }, { status: 404 })
  }
  try {
    const origin = new URL(req.url).origin
    const redirectUri = twitchRedirectUri(origin)
    const state = createOAuthState()
    const returnPath = safeReturnPath(req.nextUrl.searchParams.get('return'))
    await createTwitchOAuthState({ state, redirectUri, returnPath })
    return NextResponse.redirect(buildTwitchAuthorizeUrl({ clientId, redirectUri, state }))
  } catch (error) {
    console.error('[auth/twitch/start]', error instanceof Error ? error.message : 'failed')
    return NextResponse.json({ error: 'Could not start Twitch login.' }, { status: 500 })
  }
}
