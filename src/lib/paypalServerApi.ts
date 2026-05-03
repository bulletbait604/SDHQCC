/**
 * Server-only PayPal REST calls (OAuth + Orders). Used by webhooks and /api/paypal-capture-order.
 * Client-side `actions.order.capture()` often fails with "Buyer access token not present" in JS SDK;
 * merchant capture here avoids that.
 */

import { paypalApiBase, paypalClientCredentials } from '@/lib/paypalEnv'

type OAuthFailure =
  | { kind: 'missing_client' | 'missing_secret' }
  | { kind: 'token_rejected'; httpStatus: number }

async function fetchPayPalAccessTokenDetailed(): Promise<
  { ok: true; accessToken: string } | { ok: false; failure: OAuthFailure }
> {
  const { clientId, clientSecret } = paypalClientCredentials()

  if (!clientId) {
    console.error('PayPal credentials not configured (missing Client ID for current mode)')
    return { ok: false, failure: { kind: 'missing_client' } }
  }
  if (!clientSecret) {
    console.error('PayPal credentials not configured (missing Client Secret for current mode)')
    return { ok: false, failure: { kind: 'missing_secret' } }
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const paypalUrl = `${paypalApiBase()}/v1/oauth2/token`

  try {
    const response = await fetch(paypalUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PayPal token request failed:', response.status, errorText)
      return { ok: false, failure: { kind: 'token_rejected', httpStatus: response.status } }
    }

    const data = await response.json()
    const accessToken = data.access_token as string | undefined
    if (!accessToken) return { ok: false, failure: { kind: 'token_rejected', httpStatus: response.status } }
    return { ok: true, accessToken }
  } catch (error) {
    console.error('Error getting PayPal access token:', error)
    return { ok: false, failure: { kind: 'token_rejected', httpStatus: 0 } }
  }
}

export async function getPayPalAccessToken(): Promise<string | null> {
  const r = await fetchPayPalAccessTokenDetailed()
  return r.ok ? r.accessToken : null
}

export async function getPayPalCheckoutOrder(orderId: string): Promise<Record<string, unknown> | null> {
  try {
    const accessToken = await getPayPalAccessToken()
    if (!accessToken) return null

    const id = encodeURIComponent(orderId)
    const paypalUrl = `${paypalApiBase()}/v2/checkout/orders/${id}`

    const response = await fetch(paypalUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('PayPal get order failed:', response.status)
      return null
    }

    return (await response.json()) as Record<string, unknown>
  } catch (error) {
    console.error('Error getting order details:', error)
    return null
  }
}

/**
 * Captures an APPROVED order using merchant credentials. If capture returns an error
 * but the order is already COMPLETED (e.g. race with webhook), returns that order.
 */
export function getPurchaseUnitCustomId(order: Record<string, unknown>): string | undefined {
  const units = order.purchase_units as unknown
  if (!Array.isArray(units) || units.length === 0) return undefined
  const u = units[0] as Record<string, unknown>
  const cid = u?.custom_id
  return typeof cid === 'string' ? cid : undefined
}

export function getPurchaseUnitAmountValue(order: Record<string, unknown>): string | undefined {
  const units = order.purchase_units as unknown
  if (!Array.isArray(units) || units.length === 0) return undefined
  const u = units[0] as Record<string, unknown>
  const amt = u?.amount as Record<string, unknown> | undefined
  const v = amt?.value
  return typeof v === 'string' ? v : undefined
}

/**
 * Fulfillment gate: only orders PayPal reports as COMPLETED, with custom_id read from the API
 * (not the webhook JSON — avoids trusting tampered payloads without signature verification).
 */
export async function verifyCompletedOrderForFulfillment(orderId: string): Promise<{
  order: Record<string, unknown>
  customId: string | undefined
  amountValue: string | undefined
} | null> {
  const order = await getPayPalCheckoutOrder(orderId)
  if (!order || order.status !== 'COMPLETED') return null
  return {
    order,
    customId: getPurchaseUnitCustomId(order),
    amountValue: getPurchaseUnitAmountValue(order),
  }
}

/**
 * Confirms the Billing Plan exists for the current REST app (same sandbox/live as credentials).
 * RESOURCE_NOT_FOUND in the SDK usually means wrong `P-` id or live vs sandbox mismatch.
 */
export async function getPayPalBillingPlan(planId: string): Promise<{
  ok: boolean
  status?: string
  name?: string
  httpStatus?: number
  /** True when OAuth failed — wrong/missing client ID or secret for current mode, not necessarily a bad plan ID */
  oauthFailed?: boolean
  /** Narrow OAuth failure for UI copy (no secrets) */
  oauthFailureDetail?: 'missing_client' | 'missing_secret' | 'unauthorized' | 'other'
}> {
  const trimmed = typeof planId === 'string' ? planId.trim() : ''
  if (!trimmed) return { ok: false }

  try {
    const authResult = await fetchPayPalAccessTokenDetailed()
    if (!authResult.ok) {
      const f = authResult.failure
      if (f.kind === 'missing_client') return { ok: false, oauthFailed: true, oauthFailureDetail: 'missing_client' }
      if (f.kind === 'missing_secret') return { ok: false, oauthFailed: true, oauthFailureDetail: 'missing_secret' }
      const unauthorized =
        f.kind === 'token_rejected' && (f.httpStatus === 401 || f.httpStatus === 403)
      return {
        ok: false,
        oauthFailed: true,
        oauthFailureDetail: unauthorized ? 'unauthorized' : 'other',
      }
    }
    const accessToken = authResult.accessToken

    const id = encodeURIComponent(trimmed)
    const paypalUrl = `${paypalApiBase()}/v1/billing/plans/${id}`

    const response = await fetch(paypalUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.status === 404) {
      return { ok: false, httpStatus: 404 }
    }

    if (!response.ok) {
      return { ok: false, httpStatus: response.status }
    }

    const data = (await response.json()) as Record<string, unknown>
    return {
      ok: true,
      status: typeof data.status === 'string' ? data.status : undefined,
      name: typeof data.name === 'string' ? data.name : undefined,
    }
  } catch (error) {
    console.error('getPayPalBillingPlan failed:', error)
    return { ok: false }
  }
}

export async function capturePayPalCheckoutOrder(orderId: string): Promise<Record<string, unknown> | null> {
  try {
    const accessToken = await getPayPalAccessToken()
    if (!accessToken) {
      console.error('Cannot capture order - no access token')
      return null
    }

    const id = encodeURIComponent(orderId)
    const paypalUrl = `${paypalApiBase()}/v2/checkout/orders/${id}/capture`

    const response = await fetch(paypalUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `capture-${orderId}-${Date.now()}`,
      },
    })

    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>
      console.log(`✅ Order ${orderId} captured successfully:`, data.status)
      return data
    }

    const errorText = await response.text()
    console.error('PayPal order capture failed:', response.status, errorText)

    const order = await getPayPalCheckoutOrder(orderId)
    if (order && order.status === 'COMPLETED') {
      console.log(`Order ${orderId} already COMPLETED, treating as success`)
      return order
    }
    return null
  } catch (error) {
    console.error('Error capturing order:', error)
    return null
  }
}
