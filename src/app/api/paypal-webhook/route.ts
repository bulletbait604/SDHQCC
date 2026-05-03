import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { isPayPalSandbox, paypalApiBase } from '@/lib/paypalEnv'
import { getPayPalAccessToken, verifyCompletedOrderForFulfillment } from '@/lib/paypalServerApi'
import {
  INTERNAL_API_SECRET_HEADER,
  getInternalApiSecret,
} from '@/lib/internalApi'

// Legacy in-memory storage - kept for backwards compatibility
declare global {
  var verifiedPayments: Map<string, any>
  var verifiedUsers: Map<string, any>
}

if (!global.verifiedPayments) {
  global.verifiedPayments = new Map()
}

if (!global.verifiedUsers) {
  global.verifiedUsers = new Map()
}

// Helper function to log activity to activity-log API
async function logActivity(username: string, action: string, details?: string) {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || ''
    if (!base) {
      console.warn('[activity-log] NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_BASE_URL not set; skipping remote log')
      return
    }
    const secret = getInternalApiSecret()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (secret) {
      headers[INTERNAL_API_SECRET_HEADER] = secret
    } else {
      console.warn('[activity-log] INTERNAL_API_SECRET not set; webhook cannot authenticate activity-log POST')
      return
    }

    await fetch(`${base.replace(/\/$/, '')}/api/activity-log`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        username,
        action,
        details,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}

// Helper function to update user role in MongoDB
async function updateUserRole(username: string, role: string) {
  try {
    const client = await clientPromise
    const db = client.db('sdhq')
    
    const normalizedUsername = username.toLowerCase()
    
    const result = await db.collection('users').updateOne(
      { username: normalizedUsername },
      {
        $set: {
          username: normalizedUsername,
          role,
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    )
    
    console.log(`Role updated for ${username} to ${role}:`, result.modifiedCount || result.upsertedCount)
    return true
  } catch (error) {
    console.error('Failed to update user role:', error)
    return false
  }
}

// Helper function to store subscription in MongoDB
async function storeSubscription(subscription: any) {
  try {
    const client = await clientPromise
    const db = client.db('sdhq')
    
    const result = await db.collection('subscriptions').updateOne(
      { subscriptionId: subscription.subscriptionId },
      {
        $set: {
          ...subscription,
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    )
    
    console.log('Subscription stored:', subscription.subscriptionId)
    return true
  } catch (error) {
    console.error('Failed to store subscription:', error)
    return false
  }
}

// Helper function to cancel subscription in MongoDB
async function cancelSubscription(subscriptionId: string) {
  try {
    const client = await clientPromise
    const db = client.db('sdhq')
    
    // Get subscription details first
    const subscription = await db.collection('subscriptions').findOne({ subscriptionId })
    
    if (subscription) {
      // Update subscription status
      await db.collection('subscriptions').updateOne(
        { subscriptionId },
        {
          $set: {
            status: 'CANCELLED',
            updatedAt: new Date().toISOString()
          }
        }
      )
      
      // Downgrade user role to free
      await updateUserRole(subscription.username, 'free')
      
      // Log cancellation from helper
      await logActivity(subscription.username, 'subscription_cancelled', `Subscription cancelled (ID: ${subscriptionId})`)
      
      console.log(`Subscription ${subscriptionId} cancelled, user ${subscription.username} downgraded to free`)
    }
    
    return true
  } catch (error) {
    console.error('Failed to cancel subscription:', error)
    return false
  }
}

// Helper function to verify subscription with PayPal API
async function verifySubscriptionWithPayPal(subscriptionId: string): Promise<any | null> {
  try {
    const accessToken = await getPayPalAccessToken()
    
    if (!accessToken) {
      console.error('Cannot verify subscription - no access token')
      return null
    }
    
    const paypalUrl = `${paypalApiBase()}/v1/billing/subscriptions/${subscriptionId}`

    console.log(`PayPal: Verifying subscription`)
    
    const response = await fetch(paypalUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      console.error('PayPal subscription verification failed:', response.status)
      return null
    }
    
    const subscription = await response.json()
    console.log(`✅ Subscription verified with PayPal:`, subscription.id, 'Status:', subscription.status)
    return subscription
  } catch (error) {
    console.error('Error verifying subscription with PayPal:', error)
    return null
  }
}

// PayPal IPN verification endpoint (for one-time payments, backward compatibility)
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const params = new URLSearchParams(body)
    
    // Parse IPN data
    const ipnData: Record<string, string> = {}
    params.forEach((value, key) => {
      ipnData[key] = value
    })
    
    // Check if this is a subscription webhook (JSON format)
    const contentType = req.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      // Handle PayPal subscription webhook events
      try {
        const eventData = JSON.parse(body)
        const eventType = eventData.event_type
        
        // Handle subscription activation
        if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED' || eventType === 'BILLING.SUBSCRIPTION.CREATED') {
          const subscriptionId = eventData.resource?.id
          const customId = eventData.resource?.custom_id
          const webhookStatus = eventData.resource?.status || 'ACTIVE'
          
          if (!subscriptionId) {
            console.error('❌ Webhook received without subscription ID')
            return NextResponse.json({ status: 'error', message: 'Missing subscription ID' }, { status: 400 })
          }
          
          // 🔒 VERIFY with PayPal API before trusting the webhook
          console.log(`🔍 Verifying subscription ${subscriptionId} with PayPal API...`)
          const verifiedSubscription = await verifySubscriptionWithPayPal(subscriptionId)
          
          if (!verifiedSubscription) {
            console.error(`❌ Subscription ${subscriptionId} verification FAILED - webhook rejected`)
            return NextResponse.json({ status: 'error', message: 'Subscription verification failed' }, { status: 400 })
          }
          
          // Only proceed if PayPal confirms the subscription is ACTIVE
          if (verifiedSubscription.status !== 'ACTIVE') {
            console.error(`❌ Subscription ${subscriptionId} status is ${verifiedSubscription.status}, not ACTIVE - webhook rejected`)
            return NextResponse.json({ status: 'error', message: 'Subscription not active' }, { status: 400 })
          }
          
          // Use verified data from PayPal, not just webhook data
          const verifiedCustomId = verifiedSubscription.custom_id || customId
          const planId = verifiedSubscription.plan_id
          const startTime = verifiedSubscription.start_time || new Date().toISOString()
          const status = verifiedSubscription.status
          
          if (verifiedCustomId) {
            const parts = verifiedCustomId.split('|')
            const username = parts[0]?.trim()
            const emailFromCustomId = parts[1]?.trim()
            const sub = verifiedSubscription.subscriber as { email_address?: string } | undefined
            const emailFromPayPal =
              typeof sub?.email_address === 'string' ? sub.email_address.trim() : ''
            const paypalEmail = emailFromCustomId || emailFromPayPal || ''

            if (username) {
              // Store verified user (legacy)
              const verifiedUser = {
                username,
                paypalEmail,
                subscriptionId,
                verifiedAt: new Date().toISOString(),
                status: 'ACTIVE'
              }
              
              global.verifiedUsers.set(username.toLowerCase(), verifiedUser)
              
              // Persist subscription to MongoDB with LOWERCASE username
              const subscription = {
                username: username.toLowerCase(),
                paypalEmail,
                subscriptionId,
                status,
                planId,
                startTime,
                verifiedWithPayPal: true,
                verifiedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
              
              await storeSubscription(subscription)
              
              // Automatically upgrade user role to subscriber
              await updateUserRole(username.toLowerCase(), 'subscriber')
              
              console.log(`✅ Subscription ${subscriptionId} VERIFIED and activated for ${username}, role upgraded to subscriber`)
              
              // Log subscription payment
              await logActivity(username.toLowerCase(), 'subscription_payment', `Subscribed - $6.99/month (ID: ${subscriptionId})`)
              
              return NextResponse.json({ status: 'success', username, autoVerified: true, roleUpdated: true, verifiedWithPayPal: true })
            }
          }
        }
        
        // Handle subscription cancellation
        if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') {
          const subscriptionId = eventData.resource?.id
          
          if (subscriptionId) {
            // Verify with PayPal before processing cancellation
            const verifiedSubscription = await verifySubscriptionWithPayPal(subscriptionId)
            
            if (!verifiedSubscription || verifiedSubscription.status === 'ACTIVE') {
              // If we can't verify OR PayPal says it's still active, don't cancel
              // (could be a fake webhook or timing issue)
              console.error(`❌ Cancellation webhook for ${subscriptionId} rejected - PayPal verification failed or still active`)
              return NextResponse.json({ status: 'error', message: 'Verification failed' }, { status: 400 })
            }
            
            // Get subscription details before cancelling for logging
            const client = await clientPromise
            const db = client.db('sdhq')
            const subToCancel = await db.collection('subscriptions').findOne({ subscriptionId })
            
            await cancelSubscription(subscriptionId)
            
            // Log cancellation
            if (subToCancel) {
              await logActivity(subToCancel.username, 'subscription_cancelled', `Subscription cancelled (ID: ${subscriptionId})`)
            }
            
            console.log(`✅ Cancellation verified and processed for ${subscriptionId}`)
            return NextResponse.json({ status: 'success', subscriptionId, action: 'cancelled', verifiedWithPayPal: true })
          }
        }
        
        // Handle subscription suspension
        if (eventType === 'BILLING.SUBSCRIPTION.SUSPENDED') {
          const subscriptionId = eventData.resource?.id
          
          if (subscriptionId) {
            // Verify with PayPal before processing suspension
            const verifiedSubscription = await verifySubscriptionWithPayPal(subscriptionId)
            
            if (!verifiedSubscription) {
              console.error(`❌ Suspension webhook for ${subscriptionId} rejected - PayPal verification failed`)
              return NextResponse.json({ status: 'error', message: 'Verification failed' }, { status: 400 })
            }
            
            // Only suspend if PayPal confirms it's not active
            if (verifiedSubscription.status === 'ACTIVE') {
              console.error(`❌ Suspension webhook for ${subscriptionId} rejected - PayPal shows as ACTIVE`)
              return NextResponse.json({ status: 'error', message: 'Subscription still active' }, { status: 400 })
            }
            
            const client = await clientPromise
            const db = client.db('sdhq')
            
            const subscription = await db.collection('subscriptions').findOne({ subscriptionId })
            
            if (subscription) {
              await db.collection('subscriptions').updateOne(
                { subscriptionId },
                {
                  $set: {
                    status: 'SUSPENDED',
                    verifiedWithPayPal: true,
                    updatedAt: new Date().toISOString()
                  }
                }
              )
              
              // Suspend user access by downgrading role
              await updateUserRole(subscription.username, 'free')
              
              // Log suspension
              await logActivity(subscription.username, 'subscription_suspended', `Subscription suspended (ID: ${subscriptionId})`)
              
              console.log(`✅ Suspension verified and processed for ${subscriptionId}, user ${subscription.username} downgraded`)
            }
            
            return NextResponse.json({ status: 'success', subscriptionId, action: 'suspended', verifiedWithPayPal: true })
          }
        }
        
        // Handle subscription expiry
        if (eventType === 'BILLING.SUBSCRIPTION.EXPIRED') {
          const subscriptionId = eventData.resource?.id
          
          if (subscriptionId) {
            // Verify with PayPal before processing expiry
            const verifiedSubscription = await verifySubscriptionWithPayPal(subscriptionId)
            
            if (!verifiedSubscription) {
              console.error(`❌ Expiry webhook for ${subscriptionId} rejected - PayPal verification failed`)
              return NextResponse.json({ status: 'error', message: 'Verification failed' }, { status: 400 })
            }
            
            // Only expire if PayPal confirms it's expired
            if (verifiedSubscription.status === 'ACTIVE') {
              console.error(`❌ Expiry webhook for ${subscriptionId} rejected - PayPal shows as ACTIVE`)
              return NextResponse.json({ status: 'error', message: 'Subscription still active' }, { status: 400 })
            }
            
            const client = await clientPromise
            const db = client.db('sdhq')
            
            const subscription = await db.collection('subscriptions').findOne({ subscriptionId })
            
            if (subscription) {
              await db.collection('subscriptions').updateOne(
                { subscriptionId },
                {
                  $set: {
                    status: 'EXPIRED',
                    verifiedWithPayPal: true,
                    updatedAt: new Date().toISOString()
                  }
                }
              )
              
              // Downgrade user role
              await updateUserRole(subscription.username, 'free')
              
              // Log expiry
              await logActivity(subscription.username, 'subscription_expired', `Subscription expired (ID: ${subscriptionId})`)
              
              console.log(`✅ Expiry verified and processed for ${subscriptionId}, user ${subscription.username} downgraded`)
            }
            
            return NextResponse.json({ status: 'success', subscriptionId, action: 'expired', verifiedWithPayPal: true })
          }
        }
        
        // One-time orders: only fulfill on COMPLETED + PayPal GET shows COMPLETED and custom_id (not APPROVED / not webhook body alone)
        if (eventType === 'CHECKOUT.ORDER.COMPLETED') {
          const orderId = eventData.resource?.id as string | undefined
          if (!orderId) {
            return NextResponse.json({ status: 'error', message: 'Missing order id' }, { status: 400 })
          }

          const verified = await verifyCompletedOrderForFulfillment(orderId)
          if (!verified?.customId) {
            console.error(
              `❌ Order ${orderId} not COMPLETED in PayPal API or missing custom_id — skipping fulfillment`
            )
            return NextResponse.json(
              { status: 'error', message: 'Order not verified as completed' },
              { status: 400 }
            )
          }

          const customId = verified.customId
          const amount = verified.amountValue

          console.log(`💰 CHECKOUT.ORDER.COMPLETED: ${orderId}, custom_id (from PayPal API): ${customId}`)

          // Check for COIN purchase FIRST (format: usernameLower|coins|packageType|coinCount|price)
          if (customId.includes('coins')) {
            const parts = customId.split('|')
            const username = parts[0]?.toLowerCase()
            const packageType = parts[2]
            const coinCount = parseInt(parts[3], 10)
            const pricePart = parts[4]

            if (username && !isNaN(coinCount)) {
              const client = await clientPromise
              const db = client.db('sdhq')

              const alreadyDone = await db.collection('coinPurchases').findOne({
                orderId,
                status: 'completed',
              })
              if (alreadyDone) {
                return NextResponse.json({ status: 'success', duplicate: true, orderId })
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

              /** Upsert: coins may be bought via PayPal JS SDK (no prior row from /api/coins/purchase). */
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

              await logActivity(
                username,
                'coin_purchase',
                `Purchased ${coinCount} coins ($${pricePart ?? amount} CAD) — order ${orderId}`
              )

              console.log(`✅ ${coinCount} coins credited to ${username}`)
              return NextResponse.json({
                status: 'success',
                username,
                coins: coinCount,
                type: 'coin_purchase',
                verifiedWithPayPal: true,
              })
            }
          }

          // Donations (format: usernameLower|donation|amount|USD — PayPal JS SDK on client)
          if (customId.includes('|donation|')) {
            const parts = customId.split('|')
            const username = parts[0]?.toLowerCase()
            const donationAmount = parseFloat(parts[2])
            const currency = (parts[3] || 'USD').toUpperCase()

            if (username && !isNaN(donationAmount)) {
              const client = await clientPromise
              const db = client.db('sdhq')

              const alreadyDone = await db.collection('donations').findOne({
                orderId,
                status: 'completed',
              })
              if (alreadyDone) {
                return NextResponse.json({ status: 'success', duplicate: true, orderId })
              }

              await db.collection('donations').updateOne(
                { orderId },
                {
                  $set: {
                    userId: username,
                    amount: donationAmount,
                    currency,
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                  },
                  $setOnInsert: {
                    orderId,
                    createdAt: new Date().toISOString(),
                  },
                },
                { upsert: true }
              )

              await logActivity(
                username,
                'donation_completed',
                `Donation completed: $${donationAmount} ${currency} (order ${orderId})`
              )

              console.log(`✅ Donation recorded for ${username}: $${donationAmount} ${currency}`)
              return NextResponse.json({
                status: 'success',
                username,
                type: 'donation',
                verifiedWithPayPal: true,
              })
            }
          }

          // LEGACY: old PayPal custom_id used |tokens| (same balance as coins today)
          if (customId.includes('tokens')) {
            const parts = customId.split('|')
            const username = parts[0]
            const packageType = parts[2]
            const tokenCount = parseInt(parts[3], 10)

            if (username && !isNaN(tokenCount)) {
              // Update token balance (legacy - migrate to coins)
              const client = await clientPromise
              const db = client.db('sdhq')
              
              await db.collection('tokenBalances').updateOne(
                { userId: username.toLowerCase() },
                {
                  $inc: {
                    tokens: tokenCount,
                    totalPurchased: tokenCount
                  },
                  $set: {
                    updatedAt: new Date().toISOString()
                  }
                },
                { upsert: true }
              )
              
              // Log the purchase
              await db.collection('tokenTransactions').insertOne({
                userId: username.toLowerCase(),
                type: 'purchase',
                amount: tokenCount,
                cost: amount,
                currency: 'CAD',
                orderId,
                packageType,
                timestamp: new Date().toISOString()
              })
              
              // Update purchase record
              await db.collection('tokenPurchases').updateOne(
                { orderId },
                {
                  $set: {
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    verifiedWithPayPal: true
                  }
                }
              )
              
              await logActivity(username.toLowerCase(), 'token_purchase', `Purchased ${tokenCount} coins for $${amount} CAD (ID: ${orderId})`)
              
              console.log(`✅ ${tokenCount} coins purchased for ${username} (legacy custom_id)`)
              return NextResponse.json({ 
                status: 'success', 
                username, 
                tokens: tokenCount, 
                type: 'token_purchase',
                verifiedWithPayPal: true 
              })
            }
          }

          // Handle lifetime membership (format: username|lifetime)
          if (customId.includes('lifetime')) {
            const username = customId.split('|')[0]

            if (username) {
              // Store with LOWERCASE username to match GET endpoint search
              const subscription = {
                username: username.toLowerCase(),
                subscriptionId: orderId,
                status: 'ACTIVE',
                planId: 'lifetime',
                startTime: new Date().toISOString(),
                amount,
                isLifetime: true,
                verifiedWithPayPal: true,
                verifiedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
              
              await storeSubscription(subscription)
              await updateUserRole(username.toLowerCase(), 'subscriber_lifetime')
              
              // Log lifetime payment
              await logActivity(username.toLowerCase(), 'lifetime_payment', `Lifetime membership purchased - $${amount} CAD (ID: ${orderId})`)
              
              console.log(`✅ Lifetime membership ACTIVATED for ${username}`)
              return NextResponse.json({ status: 'success', username, autoVerified: true, isLifetime: true })
            }
          }
        }
        
        // Handle subscription update (e.g., payment failure)
        if (eventType === 'BILLING.SUBSCRIPTION.UPDATED') {
          const subscriptionId = eventData.resource?.id
          const newStatus = eventData.resource?.status
          
          if (subscriptionId && newStatus) {
            const client = await clientPromise
            const db = client.db('sdhq')
            
            await db.collection('subscriptions').updateOne(
              { subscriptionId },
              {
                $set: {
                  status: newStatus,
                  updatedAt: new Date().toISOString()
                }
              }
            )
            
            // If status is no longer ACTIVE, downgrade user
            if (newStatus !== 'ACTIVE') {
              const subscription = await db.collection('subscriptions').findOne({ subscriptionId })
              if (subscription) {
                await updateUserRole(subscription.username, 'free')
                console.log(`Subscription ${subscriptionId} status changed to ${newStatus}, user ${subscription.username} downgraded`)
              }
            }
            
            return NextResponse.json({ status: 'success', subscriptionId, action: 'updated', newStatus })
          }
        }
        
        return NextResponse.json({ status: 'received', eventType })
      } catch (jsonError) {
        console.error('Error parsing webhook JSON:', jsonError)
      }
    }
    
    // Verify IPN with PayPal (backward compatibility for one-time payments)
    const verificationParams = new URLSearchParams()
    verificationParams.append('cmd', '_notify-validate')
    
    params.forEach((value, key) => {
      verificationParams.append(key, value)
    })
    
    // Use PayPal's sandbox or live verification URL
    const paypalUrl = isPayPalSandbox()
      ? 'https://ipnpb.sandbox.paypal.com/cgi-bin/webscr'
      : 'https://ipnpb.paypal.com/cgi-bin/webscr'
    
    const verificationResponse = await fetch(paypalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: verificationParams.toString(),
    })
    
    const verificationStatus = await verificationResponse.text()
    
    if (verificationStatus === 'VERIFIED') {
      // Payment is verified
      const paymentStatus = ipnData.payment_status
      const txnType = ipnData.txn_type
      const customField = ipnData.custom || ipnData.item_name || ''
      const memo = ipnData.memo || ''
      
      // Check if payment is completed
      if (paymentStatus === 'Completed' || paymentStatus === 'Pending') {
        // Look for our verification code in custom field or memo
        const verificationCode = customField || memo
        
        // Extract username from code (format: SDHQ-USERNAME-RANDOM)
        const match = verificationCode.match(/SDHQ-([A-Za-z0-9_]+)-/)
        
        if (match) {
          const username = match[1]
          const amount = parseFloat(ipnData.mc_gross || '0')
          
          // Store verified payment in global Map
          const verifiedPayment = {
            username,
            amount,
            transactionId: ipnData.txn_id,
            verifiedAt: new Date().toISOString(),
            paymentStatus,
            verificationCode,
            currency: ipnData.mc_currency || 'CAD'
          }
          
          // Store by verification code for lookup
          global.verifiedPayments.set(verificationCode, verifiedPayment)
          
          // Return success to PayPal
          return NextResponse.json({ status: 'success', username, amount })
        }
      }
    }
    
    return NextResponse.json({ status: 'received' })
    
  } catch (error) {
    console.error('PayPal webhook error:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}

// Handle GET: client polls `?username=` after checkout until MongoDB shows subscription (production-safe).
// Debug listing without `username` stays dev-only.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')

  try {
    if (username) {
      const client = await clientPromise
      const db = client.db('sdhq')

      const subscription = await db.collection('subscriptions').findOne({
        username: username.toLowerCase(),
        status: 'ACTIVE',
      })

      if (subscription) {
        return NextResponse.json({
          verified: true,
          username: subscription.username,
          subscriptionId: subscription.subscriptionId,
          verifiedAt: subscription.createdAt,
          status: subscription.status,
          isLifetime: subscription.isLifetime || subscription.planId === 'lifetime',
        })
      }

      const userRow = await db.collection('users').findOne({ username: username.toLowerCase() })
      const role = userRow?.role as string | undefined
      if (role === 'subscriber' || role === 'subscriber_lifetime') {
        return NextResponse.json({
          verified: true,
          username: (userRow?.username as string) ?? username.toLowerCase(),
          subscriptionId: null,
          verifiedAt:
            typeof userRow?.updatedAt === 'string'
              ? userRow.updatedAt
              : new Date().toISOString(),
          status: 'ACTIVE',
          isLifetime: role === 'subscriber_lifetime',
        })
      }

      const verifiedUser = global.verifiedUsers.get(username.toLowerCase())
      if (verifiedUser) {
        return NextResponse.json({
          verified: true,
          username: verifiedUser.username,
          subscriptionId: verifiedUser.subscriptionId,
          verifiedAt: verifiedUser.verifiedAt,
          status: verifiedUser.status,
          isLifetime: false,
        })
      }

      return NextResponse.json({ verified: false })
    }

    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Get all subscriptions from MongoDB (local/debug only)
    const client = await clientPromise
    const db = client.db('sdhq')
    const subscriptions = await db.collection('subscriptions').find({}).toArray()
    
    const webhookUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/paypal-webhook`
      : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000') + '/api/paypal-webhook'
    
    return NextResponse.json({ 
      message: 'PayPal webhook endpoint active with MongoDB persistence',
      setup: 'Configure this URL in your PayPal webhook settings',
      url: webhookUrl,
      database: 'MongoDB',
      subscriptions: subscriptions.map(s => ({
        username: s.username,
        subscriptionId: s.subscriptionId,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      })),
      legacyVerifiedUsers: Array.from(global.verifiedUsers.values()),
      legacyVerifiedPayments: Array.from(global.verifiedPayments.values())
    })
  } catch (error) {
    console.error('PayPal webhook GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
