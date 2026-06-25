import { NextRequest, NextResponse } from 'next/server'
import {
  INTERNAL_API_SECRET_HEADER,
  getInternalApiSecret,
  isValidInternalApiSecret,
} from '@/lib/internalApi'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyStaffUser } from '@/lib/auth/staffAccess'

export const dynamic = 'force-dynamic'

async function runAlgorithmsUpdate(): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.CLIP_EDITOR_APP_URL || 'http://localhost:3000'
  const secret = getInternalApiSecret()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secret) {
    headers[INTERNAL_API_SECRET_HEADER] = secret
  }

  const response = await fetch(`${baseUrl}/api/algorithms`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      typeof data.userMessage === 'string'
        ? data.userMessage
        : typeof data.error === 'string'
          ? data.error
          : 'Failed to update algorithms'
    throw new Error(message)
  }

  return NextResponse.json({
    success: true,
    message: 'Algorithm data updated successfully',
    provider: typeof data.provider === 'string' ? data.provider : undefined,
    lastUpdated: typeof data.lastUpdated === 'string' ? data.lastUpdated : undefined,
  })
}

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get(INTERNAL_API_SECRET_HEADER)
    if (isValidInternalApiSecret(secret)) {
      return await runAlgorithmsUpdate()
    }

    await verifyStaffUser(req)
    return await runAlgorithmsUpdate()
  } catch (error: unknown) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('Error updating algorithms:', error)
    return NextResponse.json({ error: 'Failed to update algorithms' }, { status: 500 })
  }
}
