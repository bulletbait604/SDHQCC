import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth } from '@/lib/auth/verifyAuth'

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

// Coin packages: $5=12, $10=35, $20=100
const COIN_PACKAGES = {
  small: { coins: 12, price: 5, label: 'Starter Pack' },      // $5 = 12 coins
  medium: { coins: 35, price: 10, label: 'Value Pack' },     // $10 = 35 coins
  large: { coins: 100, price: 20, label: 'Pro Pack' }       // $20 = 100 coins
} as const

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const user = await verifyAuth(req)
    const userId = user.username

    const body = await req.json()
    const { packageType } = body

    if (!packageType) {
      return NextResponse.json({ error: 'Package type required' }, { status: 400 })
    }

    const pkg = COIN_PACKAGES[packageType as keyof typeof COIN_PACKAGES]
    if (!pkg) {
      return NextResponse.json({ 
        error: 'Invalid package type',
        validPackages: Object.keys(COIN_PACKAGES)
      }, { status: 400 })
    }

    const accessToken = await getPayPalAccessToken()
    if (!accessToken) {
      return NextResponse.json({ error: 'PayPal not configured' }, { status: 500 })
    }

    // Create PayPal order for coin purchase
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'CAD',
          value: pkg.price.toString()
        },
        description: `${pkg.coins} SDHQ Coins - ${pkg.label}`,
        custom_id: `${userId}|coins|${packageType}|${pkg.coins}|${pkg.price}`
      }],
      application_context: {
        brand_name: 'SDHQ Creator Corner',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/coins/success`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/coins/cancel`
      }
    }

    const response = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `coin-purchase-${userId}-${Date.now()}`
      },
      body: JSON.stringify(orderData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[PayPal] Order creation failed:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to create PayPal order' }, { status: 500 })
    }

    const order = await response.json()

    // Store pending coin purchase in database
    const client = await clientPromise
    const db = client.db('sdhq')
    
    await db.collection('coinPurchases').insertOne({
      userId: userId.toLowerCase(),
      orderId: order.id,
      packageType,
      coins: pkg.coins,
      price: pkg.price,
      currency: 'CAD',
      status: 'pending',
      createdAt: new Date().toISOString()
    })

    // Log the purchase attempt
    await db.collection('activity-logs').insertOne({
      id: Date.now().toString(),
      username: userId.toLowerCase(),
      timestamp: new Date().toISOString(),
      action: 'coin_purchase_initiated',
      details: `Coin purchase initiated: ${pkg.coins} coins for $${pkg.price} CAD (order: ${order.id})`
    })

    console.log(`[Coins] Purchase order created for ${userId}: ${pkg.coins} coins for $${pkg.price} CAD`)

    return NextResponse.json({
      success: true,
      orderId: order.id,
      coins: pkg.coins,
      price: pkg.price,
      packageType,
      paypalUrl: order.links.find((l: any) => l.rel === 'approve')?.href
    })

  } catch (error: any) {
    console.error('[Coins] Purchase creation error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to create purchase' 
    }, { status: 500 })
  }
}
