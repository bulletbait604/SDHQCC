import { NextRequest, NextResponse } from 'next/server'
import { capturePayPalCheckoutOrder } from '@/lib/paypalServerApi'

/**
 * Merchant-side order capture (replaces client `actions.order.capture()` which can fail with
 * "Buyer access token not present" in the JS SDK).
 *
 * Does not grant coins or memberships — fulfillment runs only in `/api/paypal-webhook` when PayPal
 * sends `CHECKOUT.ORDER.COMPLETED`, after verifying the order via PayPal's Orders GET API.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    const result = await capturePayPalCheckoutOrder(orderId)
    if (!result) {
      return NextResponse.json({ error: 'Could not capture order. Check PayPal credentials and order state.' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, status: result.status })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Capture failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
