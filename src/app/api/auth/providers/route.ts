import { NextResponse } from 'next/server'
import { twitchClientId } from '@/lib/twitch/oauth'

export const dynamic = 'force-dynamic'

/** Public flag only. The client id itself stays on the server. */
export async function GET() {
  return NextResponse.json({ twitch: Boolean(twitchClientId()) })
}
