import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { fetchKickChannel, fetchKickLeaderboards } from '@/lib/kick/fetchChannel'
import clientPromise from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    const slug = user.username
    const [channel, leaderboard] = await Promise.all([
      fetchKickChannel(slug),
      fetchKickLeaderboards(slug),
    ])

    try {
      const mongo = await clientPromise
      const dbUser = await mongo.db('sdhq').collection('users').findOne({ username: slug })
      const extras = (dbUser?.kickOAuth as { extras?: Record<string, string> } | undefined)?.extras
      const bio = extras?.bio?.trim()
      if (bio && !channel.description) channel.description = bio
      if (!channel.profileImageUrl && typeof dbUser?.profile_image_url === 'string') {
        channel.profileImageUrl = dbUser.profile_image_url
      }
      if (typeof dbUser?.display_name === 'string' && dbUser.display_name.trim()) {
        channel.displayName = dbUser.display_name
      }
    } catch {
      /* Mongo is optional for the live/offline card */
    }

    return NextResponse.json({ channel, leaderboard })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    const message = error instanceof Error ? error.message : 'Could not load Kick channel'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
