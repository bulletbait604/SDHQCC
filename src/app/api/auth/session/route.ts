import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, createAuthErrorResponse, AuthError } from '@/lib/auth/verifyAuth'

export const dynamic = 'force-dynamic'

/**
 * Validates the browser session cookie (same path as other authenticated APIs).
 * Lightweight session probe (same verification as other authenticated routes).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    return NextResponse.json({
      authenticated: true,
      id: user.id,
      username: user.username,
      role: user.role,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return createAuthErrorResponse(error)
    }
    console.error('[auth/session]', error)
    return NextResponse.json({ error: 'Session check failed' }, { status: 500 })
  }
}
