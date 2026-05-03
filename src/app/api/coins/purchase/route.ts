import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, AuthError } from '@/lib/auth/verifyAuth'
import { paypalApiBase, paypalClientCredentials } from '@/lib/paypalEnv'

async function getPayPalAccessToken(): Promise<string | null> {
  const { clientId, clientSecret } = paypalClientCredentials()

  if (!clientId || !clientSecret) {
    console.error('[PayPal] Credentials not configured')
    return null
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const base = paypalApiBase()

  try {
    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
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

const COIN_PACKAGES = {
  small: { coins: 12, price: 5, label: 'Starter Pack' },
  medium: { coins: 35, price: 10, label: 'Value Pack' },
  large: { coins: 100, price: 20, label: 'Pro Pack' },
} as const

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const usernameKey = user.username.toLowerCase()

    const body = await req.json()
    const { packageType } = body

    if (!packageType) {
      return NextResponse.json({ error: 'Package type required' }, { status: 400 })
    }

    const pkg = COIN_PACKAGES[packageType as keyof typeof COIN_PACKAGES]
    if (!pkg) {
      return NextResponse.json(
        {
          error: 'Invalid package type',
          validPackages: Object.keys(COIN_PACKAGES),
        },
        { status: 400 }
      )
    }

    const accessToken = await getPayPalAccessToken()
    if (!accessToken) {
      return NextResponse.json({ error: 'PayPal not configured' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || ''
    const base = paypalApiBase()

    /** Webhook parses username from custom_id — must match coinBalances.userId */
    const customId = `${usernameKey}|coins|${packageType}|${pkg.coins}|${pkg.price}`

    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'CAD',
            value: pkg.price.toString(),
          },
          description: `${pkg.coins} coins - ${pkg.label}`,
          custom_id: customId,
        },
      ],
      application_context: {
        brand_name: 'Stream Dreams Creator Corner',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${baseUrl}/?coins=success`,
        cancel_url: `${baseUrl}/?coins=cancel`,
      },
    }

    const response = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `coin-purchase-${usernameKey}-${Date.now()}`,
      },
      body: JSON.stringify(orderData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[PayPal] Order creation failed:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to create PayPal order' }, { status: 500 })
    }

    const order = await response.json()

    const client = await clientPromise
    const db = client.db('sdhq')

    await db.collection('coinPurchases').insertOne({
      userId: usernameKey,
      username: user.username,
      orderId: order.id,
      packageType,
      coins: pkg.coins,
      price: pkg.price,
      currency: 'CAD',
      status: 'pending',
      createdAt: new Date().toISOString(),
    })

    await db.collection('activity-logs').insertOne({
      id: Date.now().toString(),
      userId: user.id,
      username: user.username,
      timestamp: new Date().toISOString(),
      action: 'coin_purchase_initiated',
      details: `Coin purchase initiated: ${pkg.coins} coins for $${pkg.price} CAD (order: ${order.id})`,
    })

    console.log(
      `[Coins] Purchase order created for ${user.username} (${usernameKey}): ${pkg.coins} coins for $${pkg.price} CAD`
    )

    const approveLink = order.links?.find((l: { rel?: string }) => l.rel === 'approve')?.href

    return NextResponse.json({
      success: true,
      orderId: order.id,
      coins: pkg.coins,
      price: pkg.price,
      packageType,
      paypalUrl: approveLink,
    })
  } catch (error: unknown) {
    console.error('[Coins] Purchase creation error:', error)
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const err = error as { message?: string }
    return NextResponse.json(
      { error: err.message || 'Failed to create purchase' },
      { status: 500 }
    )
  }
}
