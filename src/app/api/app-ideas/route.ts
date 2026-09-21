import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, AuthError } from '@/lib/auth/verifyAuth'
import { sendContactStaffEmail } from '@/lib/sendContactNotification'

export const dynamic = 'force-dynamic'

const STAFF_EMAIL =
  process.env.FEEDBACK_NOTIFY_EMAIL?.trim() || 'bulletbait604@gmail.com'

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const payload = await req.json()
    const subject = typeof payload.subject === 'string' ? payload.subject.trim() : ''
    const body = typeof payload.body === 'string' ? payload.body.trim() : ''

    if (!subject || subject.length < 3) {
      return NextResponse.json({ error: 'Please add a short subject for your idea.' }, { status: 400 })
    }
    if (subject.length > 160) {
      return NextResponse.json({ error: 'Subject is too long.' }, { status: 400 })
    }
    if (!body || body.length < 10) {
      return NextResponse.json(
        { error: 'Please describe your idea and how we can contact you.' },
        { status: 400 }
      )
    }
    if (body.length > 8000) {
      return NextResponse.json({ error: 'Message is too long.' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('sdhq')
    await db.collection('app_idea_submissions').insertOne({
      kickUsername: user.username,
      subject,
      body,
      notifyStaffEmail: STAFF_EMAIL,
      createdAt: new Date().toISOString(),
    })

    const notify = await sendContactStaffEmail({
      kickUsername: user.username,
      message: body,
      subject: `[User APP idea] ${subject}`,
    })

    return NextResponse.json({
      ok: true,
      staffEmail: STAFF_EMAIL,
      emailSent: notify.sent,
    })
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode })
    }
    console.error('[app-ideas]', e)
    return NextResponse.json({ error: 'Could not send your idea.' }, { status: 500 })
  }
}
