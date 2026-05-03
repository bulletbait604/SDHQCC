import clientPromise from '@/lib/mongodb'
import {
  INTERNAL_API_SECRET_HEADER,
  getInternalApiSecret,
} from '@/lib/internalApi'

export type FulfillVerifiedCoinPurchaseParams = {
  orderId: string
  customId: string
  amountValue?: string
  /** When set (client completion), custom_id username must match — prevents crediting someone else's order */
  assertUsername?: string
}

export type FulfillVerifiedCoinPurchaseResult =
  | { ok: true; duplicate?: boolean; coins: number; username: string }
  | { ok: false; error: string; forbidden?: boolean }

async function logCoinPurchaseActivity(username: string, details: string) {
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
        action: 'coin_purchase',
        details,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (e) {
    console.error('[coinPurchaseFulfillment] activity-log failed', e)
  }
}

/**
 * Credits coins for a COMPLETED PayPal order whose purchase_units custom_id matches:
 * `usernameLower|coins|packageType|coinCount|price`
 * Used by webhook and POST /api/coins/complete-purchase after client-side capture.
 */
export async function fulfillVerifiedCoinPurchase(
  params: FulfillVerifiedCoinPurchaseParams
): Promise<FulfillVerifiedCoinPurchaseResult> {
  const { orderId, customId, amountValue: amount, assertUsername } = params

  if (!customId.includes('coins')) {
    return { ok: false, error: 'Not a coin purchase order' }
  }

  const parts = customId.split('|')
  const username = parts[0]?.toLowerCase()
  const packageType = parts[2]
  const coinCount = parseInt(parts[3], 10)
  const pricePart = parts[4]

  if (!username || Number.isNaN(coinCount)) {
    return { ok: false, error: 'Invalid coin purchase custom_id' }
  }

  if (
    assertUsername !== undefined &&
    assertUsername.toLowerCase() !== username
  ) {
    return {
      ok: false,
      error: 'This PayPal order belongs to another account',
      forbidden: true,
    }
  }

  const client = await clientPromise
  const db = client.db('sdhq')

  const alreadyDone = await db.collection('coinPurchases').findOne({
    orderId,
    status: 'completed',
  })
  if (alreadyDone) {
    return {
      ok: true,
      duplicate: true,
      coins: coinCount,
      username,
    }
  }

  await db.collection('coinBalances').updateOne(
    { userId: username },
    {
      $inc: {
        coins: coinCount,
        totalPurchased: coinCount,
      },
      $set: {
        updatedAt: new Date().toISOString(),
      },
      $setOnInsert: {
        userId: username,
        lastDailyReset: new Date().toISOString(),
        totalEarned: 0,
        totalSpent: 0,
        createdAt: new Date().toISOString(),
      },
    },
    { upsert: true }
  )

  await db.collection('coinPurchases').updateOne(
    { orderId },
    {
      $set: {
        userId: username,
        username,
        packageType,
        coins: coinCount,
        price: pricePart,
        currency: 'CAD',
        status: 'completed',
        completedAt: new Date().toISOString(),
        verifiedWithPayPal: true,
      },
      $setOnInsert: {
        orderId,
        createdAt: new Date().toISOString(),
      },
    },
    { upsert: true }
  )

  await db.collection('coinTransactions').insertOne({
    userId: username,
    type: 'purchase',
    amount: coinCount,
    cost: amount,
    currency: 'CAD',
    orderId,
    packageType,
    timestamp: new Date().toISOString(),
  })

  await logCoinPurchaseActivity(
    username,
    `Purchased ${coinCount} coins ($${pricePart ?? amount} CAD) — order ${orderId}`
  )

  console.log(`✅ ${coinCount} coins credited to ${username} (order ${orderId})`)

  return { ok: true, coins: coinCount, username }
}
