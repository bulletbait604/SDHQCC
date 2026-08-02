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

/**
 * True for Vercel Cron invocations. Vercel sets `x-vercel-cron: 1` automatically —
 * no CRON_SECRET env var required.
 * Optional: if CRON_SECRET is set, Bearer auth is also accepted.
 */
export function isValidCronRequest(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron') === '1') {
    return true
  }
  const cronSecret = (process.env.CRON_SECRET || '').trim()
  if (cronSecret) {
    const auth = req.headers.get('authorization') || ''
    if (auth.startsWith('Bearer ') && safeEqualString(auth.slice(7), cronSecret)) {
      return true
    }
  }
  return isValidInternalApiSecret(req.headers.get(INTERNAL_API_SECRET_HEADER))
}
