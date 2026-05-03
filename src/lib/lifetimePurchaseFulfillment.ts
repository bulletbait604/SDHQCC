import clientPromise from '@/lib/mongodb'
import {
  INTERNAL_API_SECRET_HEADER,
  getInternalApiSecret,
} from '@/lib/internalApi'
import { upsertUserRole } from '@/lib/subscriptionFulfillmentDb'

export type FulfillLifetimeParams = {
  orderId: string
  customId: string
  amountValue?: string
  assertUsername?: string
}

export type FulfillLifetimeResult =
  | { ok: true; duplicate?: boolean; username: string }
  | { ok: false; error: string; forbidden?: boolean }

async function logLifetimePayment(username: string, details: string) {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || ''
    if (!base) return
    const secret = getInternalApiSecret()
    if (!secret) return
    await fetch(`${base.replace(/\/$/, '')}/api/activity-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [INTERNAL_API_SECRET_HEADER]: secret,
      },
      body: JSON.stringify({
        username,
        action: 'lifetime_payment',
        details,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (e) {
    console.error('[lifetimePurchaseFulfillment] activity-log failed', e)
  }
}

/**
 * Lifetime Pass — PayPal custom_id: `usernameLower|lifetime` (see page.tsx createOrder).
 * Sets subscriptions doc, users.role, lifetimeMembers (/api/me isLifetime), idempotent by orderId.
 */
export async function fulfillVerifiedLifetimePurchase(
  params: FulfillLifetimeParams
): Promise<FulfillLifetimeResult> {
  const { orderId, customId, amountValue: amount, assertUsername } = params

  if (!customId.includes('lifetime')) {
    return { ok: false, error: 'Not a lifetime purchase order' }
  }

  const parts = customId.split('|')
  const rawUser = parts[0]?.trim()
  if (!rawUser) {
    return { ok: false, error: 'Missing username in custom_id' }
  }

  const username = rawUser.replace(/^@/, '').toLowerCase()

  if (assertUsername !== undefined) {
    const asserted = assertUsername.replace(/^@/, '').toLowerCase()
    if (asserted !== username) {
      return {
        ok: false,
        error: 'This PayPal order belongs to another account',
        forbidden: true,
      }
    }
  }

  const client = await clientPromise
  const db = client.db('sdhq')

  const existing = await db.collection('subscriptions').findOne({
    subscriptionId: orderId,
    planId: 'lifetime',
  })
  if (existing?.verifiedWithPayPal) {
    return {
      ok: true,
      duplicate: true,
      username: typeof existing.username === 'string' ? existing.username : username,
    }
  }

  const now = new Date().toISOString()

  await db.collection('subscriptions').updateOne(
    { subscriptionId: orderId },
    {
      $set: {
        username,
        subscriptionId: orderId,
        status: 'ACTIVE',
        planId: 'lifetime',
        startTime: now,
        amount,
        isLifetime: true,
        verifiedWithPayPal: true,
        verifiedAt: now,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  )

  await upsertUserRole(username, 'subscriber_lifetime')

  await db.collection('lifetimeMembers').updateOne(
    { username },
    {
      $set: {
        username,
        addedAt: now,
      },
    },
    { upsert: true }
  )

  await logLifetimePayment(
    username,
    `Lifetime membership purchased - $${amount ?? '89.99'} CAD (ID: ${orderId})`
  )

  console.log(`✅ Lifetime membership ACTIVATED for ${username} (order ${orderId})`)

  return { ok: true, username }
}
