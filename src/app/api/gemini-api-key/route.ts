import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'

/**
 * Returns GEMINI_API for authenticated sessions only (role enforced server-side).
 * Do not trust client-supplied user id/type.
 */
export async function POST(req: NextRequest) {
  try {
    await verifyAuth(req)

    const apiKey = process.env.GEMINI_API

    if (!apiKey) {
      console.error('[Gemini API Key] GEMINI_API not configured')
      return NextResponse.json(
        {
          error: 'Service not configured',
          userMessage: 'Gemini API is not configured. Please contact support.',
          details: 'GEMINI_API not configured',
        },
        { status: 503 }
      )
    }

    return NextResponse.json({ apiKey })
  } catch (e: unknown) {
    if (e instanceof AuthError) return createAuthErrorResponse(e)
    console.error('[Gemini API Key]', e)
    return NextResponse.json({ error: 'Failed to get API key' }, { status: 503 })
  }
}
