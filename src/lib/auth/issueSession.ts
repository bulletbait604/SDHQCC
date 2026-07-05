import type { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { getSessionSecret, signSessionJwt } from '@/lib/auth/sessionJwt'
import type { UserRole } from '@/lib/auth/verifyAuth'
import { capOwnerRole } from '@/lib/home/ownerIdentity'
import { sessionCookieSecure } from '@/lib/sessionCookie'

/** Re-issue Kick session JWT after OAuth redirects that drop the session cookie. */
export async function attachSessionCookieForUsername(
  username: string,
  req: NextRequest,
  res: NextResponse
): Promise<boolean> {
  const secret = getSessionSecret()
  if (!secret) return false

  const normalized = username.toLowerCase()
  const client = await clientPromise
  const dbUser = await client.db('sdhq').collection('users').findOne({ username: normalized })
  if (!dbUser) return false

  const role = capOwnerRole(normalized, (dbUser.role as UserRole) || 'free')
  const jwt = signSessionJwt(
    {
      sub: String(dbUser.kickId ?? normalized),
      name: normalized,
      role,
      provider: 'kick',
    },
    secret,
    60 * 60 * 24 * 30
  )

  res.cookies.set('session', jwt, {
    httpOnly: true,
    secure: sessionCookieSecure(req),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  return true
}
