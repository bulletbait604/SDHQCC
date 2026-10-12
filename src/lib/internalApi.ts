import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

/** Header clients send with `INTERNAL_API_SECRET` for server-to-server calls. */
export const INTERNAL_API_SECRET_HEADER = 'x-internal-api-secret'

export function getInternalApiSecret(): string | undefined {
  return process.env.INTERNAL_API_SECRET
}

function safeEqualString(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** Constant-time compare for raw secret strings (e.g. cron / webhook → internal routes). */
export function isValidInternalApiSecret(provided: string | null | undefined): boolean {
  const expected = getInternalApiSecret()
  if (!expected || provided === undefined || provided === null) return false
  return safeEqualString(provided, expected)
}

export function safeEqual(provided: string, expected: string): boolean {
  return safeEqualString(provided, expected)
}

/**
 * True only for Vercel Cron invocations carrying `Authorization: Bearer $CRON_SECRET`.
 * Vercel sends this header automatically when CRON_SECRET is set on the project.
 * The `x-vercel-cron` header is NOT trusted (any client can send it).
 * If CRON_SECRET is unset, cron requests are rejected (fail closed).
 */
export function isValidCronRequest(req: Pick<NextRequest, 'headers'>): boolean {
  const cronSecret = (process.env.CRON_SECRET || '').trim()
  if (!cronSecret) return false
  const auth = req.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) return false
  return safeEqualString(auth.slice(7), cronSecret)
}
