import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAuth,
  hasClipEditorAccess,
  AuthError,
  createAuthErrorResponse,
} from '@/lib/auth/verifyAuth'
import {
  shotstackEditApiRoot,
  shotstackEditApiVersion,
  shotstackAuthEnvironmentHint,
  shotstackSubmitUserMessage,
} from '@/lib/shotstackEditUrl'
import {
  resolveShotstackApiKey,
  SHOTSTACK_KEY_MISSING_USER_MESSAGE,
  shotstackKeyMissingEnvHint,
} from '@/lib/clipEditorServerKeys'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!hasClipEditorAccess(user)) {
      return NextResponse.json({ error: 'Clip Editor requires the Editor badge.' }, { status: 403 })
    }
    const apiKey = resolveShotstackApiKey()
    if (!apiKey) {
      const envHint = shotstackKeyMissingEnvHint()
      return NextResponse.json(
        {
          error: 'SHOTSTACK_API_KEY is not configured',
          userMessage: SHOTSTACK_KEY_MISSING_USER_MESSAGE,
          ...(envHint ? { envHint } : {}),
        },
        { status: 503 }
      )
    }

    const renderId = request.nextUrl.searchParams.get('renderId') || ''
    if (!renderId || renderId.length > 200) {
      return NextResponse.json({ error: 'renderId query parameter is required' }, { status: 400 })
    }

    const res = await fetch(`${shotstackEditApiRoot()}/render/${encodeURIComponent(renderId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': apiKey,
      },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const base = shotstackSubmitUserMessage(data)
      const userMessage = (base + shotstackAuthEnvironmentHint(res.status)).trim()
      return NextResponse.json(
        {
          error: userMessage,
          userMessage,
          shotstackHttpStatus: res.status,
          shotstackEditVersion: shotstackEditApiVersion(),
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
