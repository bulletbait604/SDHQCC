import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { isTrendingVidsPlatformId } from '@/lib/trendingVids/platforms'
import { researchTrendingVids } from '@/lib/trendingVids/research'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Owner-only R&D: Google-grounded top-5 trends for one social/video platform. */
export async function POST(req: NextRequest) {
  try {
    await verifyOwnerUser(req)

    const body = (await req.json().catch(() => ({}))) as { platformId?: unknown }
    const platformId = typeof body.platformId === 'string' ? body.platformId.trim().toLowerCase() : ''

    if (!platformId || !isTrendingVidsPlatformId(platformId)) {
      return NextResponse.json(
        { error: 'Choose TikTok, YouTube, Instagram, Facebook, Reddit, or Twitter.' },
        { status: 400 }
      )
    }

    const result = await researchTrendingVids({ platformId })
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[trending-vids]', err)
    const message = err instanceof Error ? err.message : 'Trend research failed'
    return NextResponse.json(
      {
        error: message,
        userMessage: 'Could not research current trends. Try another platform or retry in a moment.',
      },
      { status: 503 }
    )
  }
}
