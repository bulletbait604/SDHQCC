import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

// Helper function to get PayPal access token
async function getPayPalAccessToken(): Promise<string | null> {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    console.error('[PayPal] Credentials not configured')
    return null
  }
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  
  try {
    const response = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('[PayPal] Token request failed:', response.status, errorText)
      return null
    }
    
    const data = await response.json()
    return data.access_token
  } catch (error) {
    console.error('[PayPal] Error getting access token:', error)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { amount, currency = 'CAD' } = body

    // Validate input
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid donation amount. Must be a positive number.' },
        { status: 400 }
      )
    }

    // Get session from cookie
    const sessionCookie = req.cookies.get('session')?.value
    let username = 'anonymous'
    
    if (sessionCookie) {
      try {
        const session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString())
        if (session.username) {
          username = session.username.toLowerCase()
        }
      } catch {
        // If session parsing fails, continue with anonymous
      }
    }

    const accessToken = await getPayPalAccessToken()
    if (!accessToken) {
      return NextResponse.json({ error: 'PayPal not configured' }, { status: 500 })
    }

    // Create PayPal order for donation
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: amount.toFixed(2)
        },
        description: 'Donation to SDHQ Creator Corner',
        custom_id: `${username}|donation|${amount}|${currency}`
      }],
      application_context: {
        brand_name: 'SDHQ Creator Corner',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/donate/success`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/donate/cancel`
      }
    }

    const response = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `donation-${username}-${Date.now()}`
      },
      body: JSON.stringify(orderData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[PayPal] Order creation failed:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to create PayPal order' }, { status: 500 })
    }

    const order = await response.json()

    // Store pending donation in database
    const client = await clientPromise
    const db = client.db('sdhq')
    
    await db.collection('donations').insertOne({
      userId: username,
      orderId: order.id,
      amount,
      currency,
      status: 'pending',
      createdAt: new Date().toISOString()
    })

    // Log the donation attempt
    await db.collection('activity-logs').insertOne({
      id: Date.now().toString(),
      username,
      timestamp: new Date().toISOString(),
      action: 'donation_initiated',
      details: `Donation initiated: $${amount} ${currency} (order: ${order.id})`
    })

    console.log(`[Donate] Order created for ${username}: $${amount} ${currency}`)

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount,
      currency,
      paypalUrl: order.links.find((l: any) => l.rel === 'approve')?.href
    })

  } catch (error: any) {
    console.error('[Donate] Error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to create donation' 
    }, { status: 500 })
  }
}
