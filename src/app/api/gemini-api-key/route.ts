import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'

/** Disabled — Gemini calls run server-side only; never expose GEMINI_API to clients. */
export async function POST(req: NextRequest) {
  try {
    await verifyAuth(req)
    return NextResponse.json(
      {
        error: 'Endpoint disabled',
        userMessage:
          'Direct Gemini API access from the browser is no longer supported. Use server-side tools (tags, thumbnails, clip analyzer).',
      },
      { status: 410 }
    )
  } catch (e: unknown) {
    if (e instanceof AuthError) return createAuthErrorResponse(e)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
