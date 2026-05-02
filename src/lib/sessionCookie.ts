import type { NextRequest } from 'next/server'

/**
 * Whether the session cookie should use the Secure flag.
 * Only set Secure when the incoming request is HTTPS (or explicitly configured),
 * so cookies are not rejected on HTTP deployments while NODE_ENV=production.
 */
export function sessionCookieSecure(req?: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return false

  const proto = req?.headers.get('x-forwarded-proto')
  if (proto === 'http') return false
  if (proto === 'https') return true

  const base = process.env.NEXT_PUBLIC_BASE_URL || ''
  if (base.startsWith('http://')) return false
  if (base.startsWith('https://')) return true

  return process.env.SESSION_COOKIE_SECURE === 'true'
}
