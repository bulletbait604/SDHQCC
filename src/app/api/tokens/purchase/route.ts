import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

// Helper function to get PayPal access token
async function getPayPalAccessToken(): Promise<string | null> {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    console.error('PayPal credentials not configured')
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
      console.error('PayPal token request failed:', response.status, errorText)
      return null
    }
    
    const data = await response.json()
    return data.access_token
  } catch (error) {
    console.error('Error getting PayPal access token:', error)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, packageType, tokens, price } = body

    if (!userId || !packageType || !tokens || !price) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const allowedPackages: Record<string, { tokens: number; price: number }> = {
      basic: { tokens: 12, price: 5 },
      standard: { tokens: 35, price: 10 },
      premium: { tokens: 100, price: 20 }
    }

    const selectedPackage = allowedPackages[packageType]
    if (!selectedPackage) {
      return NextResponse.json({ error: 'Invalid token package' }, { status: 400 })
    }

    if (selectedPackage.tokens !== Number(tokens) || selectedPackage.price !== Number(price)) {
      return NextResponse.json({ error: 'Token package mismatch' }, { status: 400 })
    }

    const accessToken = await getPayPalAccessToken()
    if (!accessToken) {
      return NextResponse.json({ error: 'PayPal not configured' }, { status: 500 })
    }

    // Create PayPal order
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'CAD',
          value: price.toString()
        },
        description: `${tokens} coins`,
        custom_id: `${userId}|tokens|${packageType}|${tokens}`
      }]
    }

    const response = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `token-purchase-${userId}-${Date.now()}`
      },
      body: JSON.stringify(orderData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PayPal order creation failed:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to create PayPal order' }, { status: 500 })
    }

    const order = await response.json()

    // Store pending purchase
    const client = await clientPromise
    const db = client.db('sdhq')
    
    await db.collection('tokenPurchases').insertOne({
      userId: userId.toLowerCase(),
      orderId: order.id,
      packageType,
      tokens,
      price,
      currency: 'CAD',
      status: 'pending',
      createdAt: new Date().toISOString()
    })

    await db.collection('activity-logs').insertOne({
      id: Date.now().toString(),
      username: userId.toLowerCase(),
      timestamp: new Date().toISOString(),
      action: 'token_purchase',
      details: `Token purchase initiated: ${tokens} tokens for $${price} CAD (order: ${order.id})`
    })

    console.log(`[Tokens] Created purchase order for ${userId}: ${tokens} tokens for $${price} CAD`)

    return NextResponse.json({
      success: true,
      orderId: order.id,
      tokens,
      price
    })

  } catch (error) {
    console.error('[Tokens] Purchase creation error:', error)
    return NextResponse.json({ error: 'Failed to create purchase' }, { status: 500 })
  }
}
