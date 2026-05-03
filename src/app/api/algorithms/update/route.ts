import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { isAllowlistedOwner } from '@/lib/ownerAllowlist'
import { INTERNAL_API_SECRET_HEADER, isValidInternalApiSecret } from '@/lib/internalApi'

async function runAlgorithmsUpdate(): Promise<Response> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/algorithms`,
    {
      method: 'POST',
    }
  )

  if (!response.ok) {
    throw new Error('Failed to update algorithms')
  }

  return NextResponse.json({ success: true, message: 'Algorithm data updated successfully' })
}

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get(INTERNAL_API_SECRET_HEADER)
    if (isValidInternalApiSecret(secret)) {
      return await runAlgorithmsUpdate()
    }

    const user = await verifyAuth(req)
    const ok =
      ['admin', 'owner'].includes(user.role) || isAllowlistedOwner(user.username)
    if (!ok) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return await runAlgorithmsUpdate()
  } catch (error: unknown) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('Error updating algorithms:', error)
    return NextResponse.json({ error: 'Failed to update algorithms' }, { status: 500 })
  }
}
