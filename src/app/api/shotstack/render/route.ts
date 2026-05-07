import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAuth,
  hasClipEditorAccess,
  AuthError,
  createAuthErrorResponse,
} from '@/lib/auth/verifyAuth'
import { shotstackEditApiRoot } from '@/lib/shotstackEditUrl'
import {
  resolveShotstackApiKey,
  SHOTSTACK_KEY_MISSING_USER_MESSAGE,
  shotstackKeyMissingEnvHint,
} from '@/lib/clipEditorServerKeys'

export const dynamic = 'force-dynamic'

/** Best-effort message from Shotstack non-2xx JSON (shape varies by error type). */
function shotstackSubmitUserMessage(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return 'Shotstack rejected the render request. If your key is sandbox, leave SHOTSTACK_STAGE unset or use stage; production keys need v1.'
  }
  const d = data as Record<string, unknown>
  const parts: string[] = []
  if (typeof d.message === 'string' && d.message.trim()) parts.push(d.message.trim())
  if (typeof d.error === 'string' && d.error.trim()) parts.push(d.error.trim())
  if (Array.isArray(d.errors)) {
    for (const item of d.errors.slice(0, 6)) {
      if (typeof item === 'string' && item.trim()) {
        parts.push(item.trim())
        continue
      }
      if (item && typeof item === 'object') {
        const e = item as Record<string, unknown>
        const bit = [e.title, e.detail, e.message, e.description].find(
          (x) => typeof x === 'string' && String(x).trim()
        ) as string | undefined
        if (bit) parts.push(bit.trim())
      }
    }
  }
  const seen = new Set<string>()
  const unique: string[] = []
  for (const p of parts) {
    if (!seen.has(p)) {
      seen.add(p)
      unique.push(p)
    }
  }
  const merged = unique.join(' — ')
  if (merged) return merged.length > 500 ? `${merged.slice(0, 497)}…` : merged
  return 'Shotstack rejected the render request. Check API key, SHOTSTACK_STAGE (stage vs v1), and that the source video URL is publicly reachable by Shotstack.'
}

export async function POST(request: NextRequest) {
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

    const body = (await request.json()) as {
      timeline?: Record<string, unknown>
      output?: Record<string, unknown>
    }
    if (!body.timeline || !body.output) {
      return NextResponse.json({ error: 'timeline and output are required' }, { status: 400 })
    }

    const res = await fetch(`${shotstackEditApiRoot()}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        timeline: body.timeline,
        output: body.output,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const userMessage = shotstackSubmitUserMessage(data)
      return NextResponse.json(
        {
          error: userMessage,
          userMessage,
          provider: data,
        },
        { status: 502 }
      )
    }

    const renderId =
      (data as { response?: { id?: string } }).response?.id ||
      (data as { id?: string }).id ||
      null
    if (!renderId) {
      return NextResponse.json({ error: 'Shotstack did not return a render id', provider: data }, { status: 502 })
    }

    return NextResponse.json({ renderId })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    const message = error instanceof Error ? error.message : 'Shotstack submit failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
