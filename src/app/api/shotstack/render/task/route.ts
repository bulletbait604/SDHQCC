import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAuth,
  hasClipEditorAccess,
  AuthError,
  createAuthErrorResponse,
} from '@/lib/auth/verifyAuth'

export const dynamic = 'force-dynamic'

function shotstackBaseUrl(): string {
  const stage = (process.env.SHOTSTACK_STAGE || 'sandbox').trim().toLowerCase()
  return `https://api.shotstack.io/${stage}`
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!hasClipEditorAccess(user)) {
      return NextResponse.json({ error: 'Clip Editor requires the Editor badge.' }, { status: 403 })
    }
    const apiKey = process.env.SHOTSTACK_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'SHOTSTACK_API_KEY is not configured' }, { status: 503 })
    }

    const renderId = request.nextUrl.searchParams.get('renderId') || ''
    if (!renderId || renderId.length > 200) {
      return NextResponse.json({ error: 'renderId query parameter is required' }, { status: 400 })
    }

    const res = await fetch(`${shotstackBaseUrl()}/render/${encodeURIComponent(renderId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        {
          error: (data as { message?: string }).message || 'Shotstack status fetch failed',
          provider: data,
        },
        { status: 502 }
      )
    }
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    const message = error instanceof Error ? error.message : 'Shotstack status failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
