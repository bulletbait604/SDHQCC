import { NextRequest, NextResponse } from 'next/server'
import { sessionCookieSecure } from '@/lib/sessionCookie'

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', '', {
    httpOnly: true,
    secure: sessionCookieSecure(req),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
