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
    console.error('PayPal credentials not configured')
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
      console.error('PayPal token request failed:', response.status)
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
      console.error('PayPal subscription fetch failed:', response.status)
      return null
    }
    
    const data = await response.json()
    console.log('PayPal subscription retrieved:', data.id, data.status)
    return data
  } catch (error) {
    console.error('Error fetching PayPal subscription:', error)
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
      console.error('PayPal subscriptions list failed:', response.status)
      return []
    }
    
    const data = await response.json()
    return data.subscriptions || []
  } catch (error) {
    console.error('Error listing PayPal subscriptions:', error)
    return []
  }
}

export async function POST(req: NextRequest) {
  try {
    const { paymentCode, username, subscriptionId } = await req.json()
    
    if (!paymentCode || !username) {
      return NextResponse.json(
        { error: 'Missing payment code or username' },
        { status: 400 }
      )
    }
    
    console.log('Checking subscription for code:', paymentCode, 'username:', username, 'subscriptionId:', subscriptionId)
    
    // First, check webhook storage (for backwards compatibility)
    if (!global.verifiedPayments) {
      global.verifiedPayments = new Map()
    }
    
    const webhookPayment = global.verifiedPayments.get(paymentCode)
    
    if (webhookPayment) {
      console.log('Payment found in webhook storage:', webhookPayment)
      
      if (webhookPayment.username !== username) {
        return NextResponse.json({
          verified: false,
          message: 'Payment code does not match username.',
        })
      }
      
      return NextResponse.json({
        verified: true,
        transactionId: webhookPayment.transactionId,
        subscriptionId: webhookPayment.subscriptionId,
        timestamp: webhookPayment.verifiedAt,
        source: 'webhook',
      })
    }
    
    // If subscription ID is provided, check it directly
    if (subscriptionId) {
      const accessToken = await getPayPalAccessToken()
      
      if (!accessToken) {
        return NextResponse.json({
          verified: false,
          message: 'PayPal API authentication failed. Please contact support.',
        })
      }
      
      const subscription = await getPayPalSubscription(accessToken, subscriptionId)
      
      if (subscription) {
        // Check if subscription is active
        if (subscription.status === 'ACTIVE') {
          // Extract custom_id to verify it matches our code and username
          const customId = subscription.custom_id || ''
          const [code, subUsername] = customId.split('|')
          
          if (code === paymentCode && subUsername?.toLowerCase() === username.toLowerCase()) {
            console.log('Subscription verified:', subscription.id)
            
            // Store in webhook storage for future reference
            global.verifiedPayments.set(paymentCode, {
              username,
              subscriptionId: subscription.id,
              verifiedAt: new Date().toISOString(),
              paymentStatus: subscription.status,
              verificationCode: paymentCode,
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
    const accessToken = await getPayPalAccessToken()
    
    if (!accessToken) {
      return NextResponse.json({
        verified: false,
        message: 'PayPal API authentication failed. Please contact support.',
      })
    }
    
    // List recent subscriptions and search for matching custom_id
    const subscriptions = await listPayPalSubscriptions(accessToken)
    
    for (const sub of subscriptions) {
      if (sub.status === 'ACTIVE') {
        const customId = sub.custom_id || ''
        const [code, subUsername] = customId.split('|')
        
        if (code === paymentCode && subUsername?.toLowerCase() === username.toLowerCase()) {
          console.log('Found matching subscription:', sub.id)
          
          // Store in webhook storage for future reference
          global.verifiedPayments.set(paymentCode, {
            username,
            subscriptionId: sub.id,
            verifiedAt: new Date().toISOString(),
            paymentStatus: sub.status,
            verificationCode: paymentCode,
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
    
    console.log('No matching subscription found')
    
    return NextResponse.json({
      verified: false,
      message: 'Subscription not found. Make sure you:\n1. Completed the PayPal subscription\n2. The subscription is active\n3. Wait a moment for PayPal to process (can take 1-2 minutes)\n\nOr provide your Subscription ID from PayPal.',
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
