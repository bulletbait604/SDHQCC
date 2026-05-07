import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAuth,
  hasClipEditorAccess,
  AuthError,
  createAuthErrorResponse,
} from '@/lib/auth/verifyAuth'
import { shotstackEditApiRoot } from '@/lib/shotstackEditUrl'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!hasClipEditorAccess(user)) {
      return NextResponse.json({ error: 'Clip Editor requires the Editor badge.' }, { status: 403 })
    }
    const apiKey = process.env.SHOTSTACK_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'SHOTSTACK_API_KEY is not configured' }, { status: 503 })
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
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        timeline: body.timeline,
        output: body.output,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        {
          error: (data as { message?: string }).message || 'Shotstack render submit failed',
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
