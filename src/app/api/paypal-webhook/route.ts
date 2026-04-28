import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

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
      console.log(`Subscription ${subscriptionId} cancelled, user ${subscription.username} downgraded to free`)
    }
    
    return true
  } catch (error) {
    console.error('Failed to cancel subscription:', error)
    return false
  }
}

// Helper function to get PayPal access token
async function getPayPalAccessToken(): Promise<string | null> {
  const isSandbox = process.env.PAYPAL_MODE === 'sandbox'
  const clientId = isSandbox ? process.env.PAYPAL_CLIENT_ID_SANDBOX : process.env.PAYPAL_CLIENT_ID
  const clientSecret = isSandbox ? process.env.PAYPAL_CLIENT_SECRET_SANDBOX : process.env.PAYPAL_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    console.error('PayPal credentials not configured', { isSandbox, hasClientId: !!clientId, hasSecret: !!clientSecret })
    return null
  }
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  
  try {
    const paypalUrl = isSandbox
      ? 'https://api-m.sandbox.paypal.com/v1/oauth2/token'
      : 'https://api-m.paypal.com/v1/oauth2/token'
    
    console.log(`PayPal: Using ${isSandbox ? 'SANDBOX' : 'LIVE'} mode for token`)
    
    const response = await fetch(paypalUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('PayPal token request failed:', response.status, errorText)
      console.error('PayPal credentials check:', { 
        isSandbox, 
        clientIdPrefix: clientId?.substring(0, 10) + '...',
        secretLength: clientSecret?.length,
        url: paypalUrl 
      })
      return null
    }
    
    const data = await response.json()
    return data.access_token
  } catch (error) {
    console.error('Error getting PayPal access token:', error)
    return null
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
    
    const isSandbox = process.env.PAYPAL_MODE === 'sandbox'
    const paypalUrl = isSandbox
      ? `https://api-m.sandbox.paypal.com/v1/billing/subscriptions/${subscriptionId}`
      : `https://api-m.paypal.com/v1/billing/subscriptions/${subscriptionId}`
    
    console.log(`PayPal: Verifying subscription in ${isSandbox ? 'SANDBOX' : 'LIVE'} mode`)
    
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
            const [username, paypalEmail] = verifiedCustomId.split('|')
            
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
              
              // Persist subscription to MongoDB
              const subscription = {
                username,
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
              await updateUserRole(username, 'subscriber')
              
              console.log(`✅ Subscription ${subscriptionId} VERIFIED and activated for ${username}, role upgraded to subscriber`)
              
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
            
            await cancelSubscription(subscriptionId)
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
              console.log(`✅ Expiry verified and processed for ${subscriptionId}, user ${subscription.username} downgraded`)
            }
            
            return NextResponse.json({ status: 'success', subscriptionId, action: 'expired', verifiedWithPayPal: true })
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
    const isSandbox = process.env.PAYPAL_MODE === 'sandbox'
    const paypalUrl = isSandbox
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

// Handle GET for testing and checking verification status
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')
  
  try {
    if (username) {
      // Check MongoDB first
      const client = await clientPromise
      const db = client.db('sdhq')
      
      const subscription = await db.collection('subscriptions').findOne({
        username: username.toLowerCase(),
        status: 'ACTIVE'
      })
      
      if (subscription) {
        return NextResponse.json({
          verified: true,
          username: subscription.username,
          subscriptionId: subscription.subscriptionId,
          verifiedAt: subscription.createdAt,
          status: subscription.status
        })
      }
      
      // Fallback to legacy check
      const verifiedUser = global.verifiedUsers.get(username.toLowerCase())
      if (verifiedUser) {
        return NextResponse.json({ 
          verified: true,
          username: verifiedUser.username,
          subscriptionId: verifiedUser.subscriptionId,
          verifiedAt: verifiedUser.verifiedAt,
          status: verifiedUser.status
        })
      }
      
      return NextResponse.json({ verified: false })
    }
    
    // Get all subscriptions from MongoDB
    const client = await clientPromise
    const db = client.db('sdhq')
    const subscriptions = await db.collection('subscriptions').find({}).toArray()
    
    return NextResponse.json({ 
      message: 'PayPal webhook endpoint active with MongoDB persistence',
      setup: 'Configure this URL in your PayPal webhook settings',
      url: 'https://sdhqcc.vercel.app/api/paypal-webhook',
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
