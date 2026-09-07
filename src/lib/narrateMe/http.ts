import { NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'

export function statusOf(err: unknown): number {
  if (err && typeof err === 'object' && 'status' in err) {
    const s = (err as { status?: unknown }).status
    if (typeof s === 'number' && s >= 400 && s < 600) return s
  }
  return 503
}

export function narrateMeErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) return createAuthErrorResponse(err)
  console.error('[narrate-me]', err)
  const message = err instanceof Error ? err.message : 'Narrate Me failed'
  return NextResponse.json({ error: message, userMessage: message }, { status: statusOf(err) })
}
