import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { deleteDestinyUser, getDestinyUserBySiteUserId } from '@/lib/destiny/destinyUserStore'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const stored = await getDestinyUserBySiteUserId(user.username.toLowerCase())
    if (!stored) {
      return NextResponse.json({ ok: true, linked: false })
    }
    await deleteDestinyUser(user.username.toLowerCase())
    return NextResponse.json({ ok: true, linked: false })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    return NextResponse.json({ error: 'Failed to disconnect Bungie account' }, { status: 500 })
  }
}
