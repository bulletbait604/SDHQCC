import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyStaffUser } from '@/lib/auth/staffAccess'

export const dynamic = 'force-dynamic'

export async function destinyStaffHandler(
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    await verifyStaffUser(req)
    return await handler()
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[destiny]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
