import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import {
  isPayPalSandbox,
  paypalApiBase,
  paypalClientCredentials,
} from '@/lib/paypalEnv'

// Reference to global verified payments from webhook (legacy)
declare global {
  var verifiedPayments: Map<string, any>
}

// Get PayPal access token
async function getPayPalAccessToken(): Promise<string | null> {
  const { clientId, clientSecret } = paypalClientCredentials()

  if (!clientId || !clientSecret) {
    console.error('PayPal credentials not configured', { hasClientId: !!clientId, hasSecret: !!clientSecret })
    return null
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  try {
    const paypalUrl = `${paypalApiBase()}/v1/oauth2/token`

    console.log(`PayPal: Getting token in ${isPayPalSandbox() ? 'SANDBOX' : 'LIVE'} mode`)

    const response = await fetch(paypalUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data.access_token
  } catch (error) {
    console.error('Error getting PayPal access token:', error)
    return null
  }
}

// Get subscription details from PayPal
async function getPayPalSubscription(accessToken: string, subscriptionId: string): Promise<any | null> {
  try {
    const paypalUrl = `${paypalApiBase()}/v1/billing/subscriptions/${subscriptionId}`
    
    const response = await fetch(paypalUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    return null
  }
}

/** Email PayPal stores on the subscription (canonical for verification). */
function subscriberEmailFromSubscription(subscription: Record<string, unknown>): string | undefined {
  const sub = subscription?.subscriber as Record<string, unknown> | undefined
  const raw = sub?.email_address
  return typeof raw === 'string' ? raw.toLowerCase().trim() : undefined
}

function emailsMatchVerification(
  paypalEmailEntered: string,
  storedFromCustomId: string | undefined,
  subscriberEmail: string | undefined
): boolean {
  const entered = paypalEmailEntered.toLowerCase().trim()
  const stored = (storedFromCustomId || '').toLowerCase().trim()

  // No typed-in email: trust PayPal API + username match (subscription already verified ACTIVE).
  if (!entered) {
    return true
  }

  // Canonical: PayPal subscriber email (always matches the paying sandbox/live account).
  if (subscriberEmail && subscriberEmail === entered) {
    return true
  }
  // Fallback: email embedded in custom_id at subscribe time.
  if (stored && stored === entered) {
    return true
  }
  return false
}

// List subscriptions for a business account
async function listPayPalSubscriptions(accessToken: string): Promise<any[]> {
  try {
    const paypalUrl = `${paypalApiBase()}/v1/billing/subscriptions`

    const response = await fetch(paypalUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      return []
    }
    
    const data = await response.json()
    return data.subscriptions || []
  } catch (error) {
    return []
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const username = typeof body.username === 'string' ? body.username : ''
    const subscriptionId = typeof body.subscriptionId === 'string' ? body.subscriptionId : ''
    const paypalEmailRaw = typeof body.paypalEmail === 'string' ? body.paypalEmail : ''
    const paypalEmailEntered = paypalEmailRaw.trim()

    if (!username) {
      return NextResponse.json({ error: 'Missing username' }, { status: 400 })
    }

    // First, check MongoDB for active subscription
    const client = await clientPromise
    const db = client.db('sdhq')

    const dbQuery =
      paypalEmailEntered.length > 0
        ? {
            username: username.toLowerCase(),
            paypalEmail: paypalEmailEntered.toLowerCase(),
            status: 'ACTIVE' as const,
          }
        : { username: username.toLowerCase(), status: 'ACTIVE' as const }

    const dbSubscription = await db.collection('subscriptions').findOne(dbQuery)

    if (dbSubscription) {
      return NextResponse.json({
        verified: true,
        subscriptionId: dbSubscription.subscriptionId,
        status: dbSubscription.status,
        timestamp: dbSubscription.createdAt,
        source: 'mongodb',
      })
    }

    // Fallback: check webhook storage (for backwards compatibility)
    if (!global.verifiedPayments) {
      global.verifiedPayments = new Map()
    }

    const webhookPayment = Array.from(global.verifiedPayments.values()).find(
      (payment: any) => payment.username === username
    )

    if (webhookPayment) {
      return NextResponse.json({
        verified: true,
        transactionId: webhookPayment.transactionId,
        subscriptionId: webhookPayment.subscriptionId,
        timestamp: webhookPayment.verifiedAt,
        source: 'webhook',
      })
    }
    
    // Get PayPal access token
    const accessToken = await getPayPalAccessToken()
    
    if (!accessToken) {
      return NextResponse.json({
        verified: false,
        message: 'PayPal API authentication failed. Please contact support.',
      })
    }
    
    // If subscription ID is provided, check it directly
    if (subscriptionId) {
      const subscription = await getPayPalSubscription(accessToken, subscriptionId)
      
      if (subscription) {
        // Check if subscription is active
        if (subscription.status === 'ACTIVE') {
          // Extract custom_id to verify it matches our username
          const customId = subscription.custom_id || ''
          const [subUsername, storedEmail] = customId.split('|')
          const payerEmail = subscriberEmailFromSubscription(subscription as Record<string, unknown>)
          const resolvedPaypalEmail =
            paypalEmailEntered || payerEmail || storedEmail || ''

          if (
            subUsername?.toLowerCase() === username.toLowerCase() &&
            emailsMatchVerification(paypalEmailEntered, storedEmail, payerEmail)
          ) {

            // Persist to MongoDB
            await db.collection('subscriptions').updateOne(
              { subscriptionId: subscription.id },
              {
                $set: {
                  username,
                  paypalEmail: resolvedPaypalEmail,
                  subscriptionId: subscription.id,
                  status: subscription.status,
                  planId: subscription.plan_id,
                  startTime: subscription.start_time,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }
              },
              { upsert: true }
            )

            // Store in webhook storage for future reference (legacy)
            const storageKey = `${username}-${subscription.id}`
            global.verifiedPayments.set(storageKey, {
              username,
              subscriptionId: subscription.id,
              verifiedAt: new Date().toISOString(),
              paymentStatus: subscription.status,
              paypalEmail: resolvedPaypalEmail,
            })

            return NextResponse.json({
              verified: true,
              transactionId: subscription.id,
              subscriptionId: subscription.id,
              status: subscription.status,
              timestamp: subscription.create_time,
              source: 'subscription_api',
            })
          }
        }
      }
    }
    
    // If no subscription ID provided or direct check failed, try to find by searching
    const subscriptions = await listPayPalSubscriptions(accessToken)
    
    for (const sub of subscriptions) {
      if (sub.status === 'ACTIVE') {
        const customId = sub.custom_id || ''
        const [subUsername, storedEmail] = customId.split('|')

        const full = await getPayPalSubscription(accessToken, sub.id)
        const payerEmail = full ? subscriberEmailFromSubscription(full as Record<string, unknown>) : undefined
        const resolvedPaypalEmail =
          paypalEmailEntered || payerEmail || storedEmail || ''

        if (
          subUsername?.toLowerCase() === username.toLowerCase() &&
          emailsMatchVerification(paypalEmailEntered, storedEmail, payerEmail)
        ) {
          // Persist to MongoDB
          await db.collection('subscriptions').updateOne(
            { subscriptionId: sub.id },
            {
              $set: {
                username,
                paypalEmail: resolvedPaypalEmail,
                subscriptionId: sub.id,
                status: sub.status,
                planId: sub.plan_id,
                startTime: sub.start_time,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            },
            { upsert: true }
          )

          // Store in webhook storage for future reference (legacy)
          const storageKey = `${username}-${sub.id}`
          global.verifiedPayments.set(storageKey, {
            username,
            subscriptionId: sub.id,
            verifiedAt: new Date().toISOString(),
            paymentStatus: sub.status,
            paypalEmail: resolvedPaypalEmail,
          })

          return NextResponse.json({
            verified: true,
            transactionId: sub.id,
            subscriptionId: sub.id,
            status: sub.status,
            timestamp: sub.create_time,
            source: 'subscription_list',
          })
        }
      }
    }

    
    return NextResponse.json({
      verified: false,
      message:
        'Subscription not found. Make sure you:\n1. Completed the PayPal subscription\n2. The subscription is active\n3. Your KICK username matches the account used when subscribing',
    })
    
  } catch (error) {
    console.error('Check subscription error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to verify subscription'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// GET endpoint for debugging - shows stored subscriptions from MongoDB
export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
