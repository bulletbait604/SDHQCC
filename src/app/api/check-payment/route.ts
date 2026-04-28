import { NextRequest, NextResponse } from 'next/server'

// Reference to global verified payments from webhook
declare global {
  var verifiedPayments: Map<string, any>
}

// Get PayPal access token
async function getPayPalAccessToken(): Promise<string | null> {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    return null
  }
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  
  try {
    const paypalUrl = process.env.NODE_ENV === 'production'
      ? 'https://api-m.paypal.com/v1/oauth2/token'
      : 'https://api-m.sandbox.paypal.com/v1/oauth2/token'
    
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
    const paypalUrl = process.env.NODE_ENV === 'production'
      ? `https://api-m.paypal.com/v1/billing/subscriptions/${subscriptionId}`
      : `https://api-m.sandbox.paypal.com/v1/billing/subscriptions/${subscriptionId}`
    
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

// List subscriptions for a business account
async function listPayPalSubscriptions(accessToken: string): Promise<any[]> {
  try {
    const paypalUrl = process.env.NODE_ENV === 'production'
      ? 'https://api-m.paypal.com/v1/billing/subscriptions'
      : 'https://api-m.sandbox.paypal.com/v1/billing/subscriptions'
    
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
    const { paypalEmail, username, subscriptionId } = await req.json()
    
    if (!paypalEmail || !username) {
      return NextResponse.json(
        { error: 'Missing PayPal email or username' },
        { status: 400 }
      )
    }
    
    
    // First, check webhook storage (for backwards compatibility)
    if (!global.verifiedPayments) {
      global.verifiedPayments = new Map()
    }
    
    // Check if we have a verified payment for this user
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
          
          // Match username and email
          if (subUsername?.toLowerCase() === username.toLowerCase() && storedEmail?.toLowerCase() === paypalEmail.toLowerCase()) {
            
            // Store in webhook storage for future reference
            const storageKey = `${username}-${subscription.id}`
            global.verifiedPayments.set(storageKey, {
              username,
              subscriptionId: subscription.id,
              verifiedAt: new Date().toISOString(),
              paymentStatus: subscription.status,
              paypalEmail,
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
        
        // Match username and email
        if (subUsername?.toLowerCase() === username.toLowerCase() && storedEmail?.toLowerCase() === paypalEmail.toLowerCase()) {
          
          // Store in webhook storage for future reference
          const storageKey = `${username}-${sub.id}`
          global.verifiedPayments.set(storageKey, {
            username,
            subscriptionId: sub.id,
            verifiedAt: new Date().toISOString(),
            paymentStatus: sub.status,
            paypalEmail,
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
      message: 'Subscription not found. Make sure you:\n1. Completed the PayPal subscription\n2. The subscription is active\n3. The PayPal email you entered matches the one used for the subscription\n4. Your KICK username matches the one used during subscription',
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

// GET endpoint for debugging - shows stored payments
export async function GET() {
  // Initialize if not exists
  if (!global.verifiedPayments) {
    global.verifiedPayments = new Map()
  }
  
  // Convert Map to array for JSON response
  const payments = Array.from(global.verifiedPayments.entries()).map(([code, payment]) => ({
    code,
    ...payment
  }))
  
  return NextResponse.json({
    system: 'Webhook-based verification only',
    totalPayments: global.verifiedPayments.size,
    storedPayments: payments,
    message: 'Payments are stored when PayPal webhook is received',
    setup: 'Configure webhook at https://developer.paypal.com/dashboard/applications',
    webhookUrl: 'https://sdhqcc.vercel.app/api/paypal-webhook'
  })
}
