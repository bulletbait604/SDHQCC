import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { fetchKickChannel } from '@/lib/kick/fetchChannel'
import { buildChannelInsights } from '@/lib/home/channelInsights'
import clientPromise from '@/lib/mongodb'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CACHE_MS = 24 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    const refresh = request.nextUrl.searchParams.get('refresh') === '1'
    const mongo = await clientPromise
    const col = mongo.db('sdhq').collection('channelInsights')

    if (!refresh) {
      const cached = await col.findOne({ username: user.username })
      const updatedAt = typeof cached?.updatedAt === 'string' ? Date.parse(cached.updatedAt) : 0
      if (cached?.insights && Date.now() - updatedAt < CACHE_MS) {
        return NextResponse.json({ insights: cached.insights, cached: true, updatedAt: cached.updatedAt })
      }
    }

    const channel = await fetchKickChannel(user.username, { fresh: refresh })
    const insights = await buildChannelInsights({
      username: user.username,
      displayName: channel.displayName,
      description: channel.description,
      recentCategories: channel.recentCategories,
      socials: channel.socials,
    })
    const updatedAt = new Date().toISOString()
    await col.updateOne(
      { username: user.username },
      { $set: { username: user.username, insights, updatedAt } },
      { upsert: true }
    )
    return NextResponse.json({ insights, cached: false, updatedAt })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    const message = error instanceof Error ? error.message : 'Could not build channel insights'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
