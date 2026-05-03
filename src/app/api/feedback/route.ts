import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, AuthError } from '@/lib/auth/verifyAuth'

export const dynamic = 'force-dynamic'

const STAFF_EMAIL = 'bulletbait604@gmail.com'

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const body = await req.json()
    const replyEmail = typeof body.replyEmail === 'string' ? body.replyEmail.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    if (!replyEmail || !isValidEmail(replyEmail)) {
      return NextResponse.json({ error: 'A valid reply email address is required.' }, { status: 400 })
    }
    if (!message || message.length < 5) {
      return NextResponse.json({ error: 'Please write a short message so we know how to help.' }, { status: 400 })
    }
    if (message.length > 20000) {
      return NextResponse.json({ error: 'Message is too long.' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('sdhq')
    await db.collection('feedback_submissions').insertOne({
      kickUsername: user.username,
      replyEmail,
      message,
      notifyStaffEmail: STAFF_EMAIL,
      createdAt: new Date().toISOString(),
    })

    return NextResponse.json({
      ok: true,
      staffEmail: STAFF_EMAIL,
    })
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode })
    }
    console.error('[feedback]', e)
    return NextResponse.json({ error: 'Could not save feedback.' }, { status: 500 })
  }
}
