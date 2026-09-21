import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { fetchKickChannel, fetchKickClips } from '@/lib/kick/fetchChannel'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || '1') || 1)
    const channel = await fetchKickChannel(user.username).catch(() => null)
    const all = await fetchKickClips(user.username, 25, channel?.channelId)
    const pageSize = 25
    const start = (page - 1) * pageSize
    const clips = all.slice(start, start + pageSize)
    return NextResponse.json({
      clips,
      page,
      pageSize,
      total: all.length,
      hasMore: start + clips.length < all.length,
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    const message = error instanceof Error ? error.message : 'Could not load Kick clips'
    return NextResponse.json({ error: message, clips: [] }, { status: 502 })
  }
}
