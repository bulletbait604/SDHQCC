import { timingSafeEqual } from 'crypto'

/** Header clients send with `INTERNAL_API_SECRET` for server-to-server calls. */
export const INTERNAL_API_SECRET_HEADER = 'x-internal-api-secret'

export function getInternalApiSecret(): string | undefined {
  return process.env.INTERNAL_API_SECRET
}

/** Constant-time compare for raw secret strings (e.g. cron / webhook → internal routes). */
export function isValidInternalApiSecret(provided: string | null | undefined): boolean {
  const expected = getInternalApiSecret()
  if (!expected || provided === undefined || provided === null) return false
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
