import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import {
  AuthError,
  createAuthErrorResponse,
  hasUnlimitedAccess,
  verifyAuth,
} from '@/lib/auth/verifyAuth'
import { isProTrialActive, trialEndsAtFrom } from '@/lib/billing/trial'
import { PRO_TRIAL_DAYS } from '@/lib/billing/plans'

export const dynamic = 'force-dynamic'

/**
 * App-side 7-day Pro trial stored on the user document.
 * PayPal plan trials are configured when a new billing plan is created
 * (`scripts/create-paypal-plan.ts`); this flag works before those plan IDs exist.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (hasUnlimitedAccess(user)) {
      return NextResponse.json({
        ok: true,
        alreadyPro: true,
        message: 'This account already has Pro access.',
      })
    }
    if (isProTrialActive(user.proTrialEndsAt)) {
      return NextResponse.json({
        ok: true,
        alreadyActive: true,
        trialEndsAt: user.proTrialEndsAt,
      })
    }

    const client = await clientPromise
    const db = client.db('sdhq')
    const username = user.username.toLowerCase()
    const existing = await db.collection('users').findOne({ username })
    if (existing?.proTrialUsed) {
      return NextResponse.json(
        { ok: false, error: 'The free Pro trial has already been used on this account.' },
        { status: 409 }
      )
    }

    const started = new Date()
    const ends = trialEndsAtFrom(started, PRO_TRIAL_DAYS)
    await db.collection('users').updateOne(
      { username },
      {
        $set: {
          username,
          proTrialUsed: true,
          proTrialStartedAt: started.toISOString(),
          proTrialEndsAt: ends.toISOString(),
          updatedAt: started.toISOString(),
        },
      },
      { upsert: true }
    )

    return NextResponse.json({
      ok: true,
      trialDays: PRO_TRIAL_DAYS,
      trialStartedAt: started.toISOString(),
      trialEndsAt: ends.toISOString(),
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[trial/start]', error)
    return NextResponse.json({ error: 'Could not start the Pro trial' }, { status: 500 })
  }
}
