import { NextResponse } from 'next/server'
import {
  isPayPalSandbox,
  paypalSdkClientId,
  paypalSdkPlanId,
  paypalSubscriptionPlanIdFormatOk,
} from '@/lib/paypalEnv'

/**
 * Public PayPal SDK settings (client ID is not secret — same as NEXT_PUBLIC_*).
 * Read at request time so sandbox/live switches work without rebuilding static client bundles.
 */
export async function GET() {
  const sandbox = isPayPalSandbox()
  const clientId = paypalSdkClientId() ?? null
  const planId = paypalSdkPlanId() ?? null

  const warnings: string[] = []
  if (sandbox && !clientId) {
    warnings.push(
      'Sandbox mode is active but no sandbox Client ID was found. Set NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX (recommended) or PAYPAL_CLIENT_ID_SANDBOX in Vercel.'
    )
  }
  if (!planId) {
    warnings.push(
      sandbox
        ? 'Monthly Subscribe: set NEXT_PUBLIC_PAYPAL_PLAN_ID_SANDBOX (or NEXT_PUBLIC_PAYPAL_PLAN_ID) to the Plan ID from PayPal → Subscription plans. Lifetime Pass is a one-time payment — it does not use plan IDs.'
        : 'Monthly Subscribe: set NEXT_PUBLIC_PAYPAL_PLAN_ID to the Plan ID from PayPal → Subscription plans. Lifetime Pass is one-time checkout — no plan ID.'
    )
  }
  if (planId && !paypalSubscriptionPlanIdFormatOk(planId)) {
    warnings.push(
      'Subscribe uses a Billing Plan ID that starts with P- (PayPal → Subscription plans → copy Plan ID). Values starting with PROD- are Product IDs and will fail with INVALID_RESOURCE_ID.'
    )
  }

  return NextResponse.json({
    sandbox,
    clientId,
    planId,
    /** false when planId looks like PROD-xxx / wrong shape — Subscribe will fail at PayPal */
    planIdFormatOk: planId ? paypalSubscriptionPlanIdFormatOk(planId) : null,
    warning: warnings.length ? warnings.join(' ') : null,
  })
}
