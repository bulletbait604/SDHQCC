import { NextRequest, NextResponse } from 'next/server'
import { sessionCookieSecure } from '@/lib/sessionCookie'

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  const secure = sessionCookieSecure(req)
  res.cookies.set('session', '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  })
  return res
}
