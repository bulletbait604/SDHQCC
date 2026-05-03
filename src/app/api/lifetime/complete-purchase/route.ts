import { NextRequest, NextResponse } from 'next/server'
import { verifyCompletedOrderForFulfillment } from '@/lib/paypalServerApi'
import { fulfillVerifiedLifetimePurchase } from '@/lib/lifetimePurchaseFulfillment'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'

export const dynamic = 'force-dynamic'

/**
 * After client capture of Lifetime Pass order, grant role + lifetimeMembers (webhook may be delayed).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const body = (await req.json()) as { orderId?: string }
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    const verified = await verifyCompletedOrderForFulfillment(orderId)
    if (!verified?.customId) {
      return NextResponse.json(
        { error: 'Order not completed in PayPal yet. Wait a few seconds and refresh, or contact support.' },
        { status: 400 }
      )
    }

    const result = await fulfillVerifiedLifetimePurchase({
      orderId,
      customId: verified.customId,
      amountValue: verified.amountValue,
      assertUsername: user.username,
    })

    if (!result.ok) {
      const status = result.forbidden ? 403 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      username: result.username,
    })
  } catch (error: unknown) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[lifetime/complete-purchase]', error)
    return NextResponse.json({ error: 'Failed to complete lifetime purchase' }, { status: 500 })
  }
}
