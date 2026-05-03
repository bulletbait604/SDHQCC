import { NextResponse } from 'next/server'
import { isPayPalSandbox, paypalSdkClientId, paypalSdkPlanId } from '@/lib/paypalEnv'

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

  return NextResponse.json({
    sandbox,
    clientId,
    planId,
    warning: warnings.length ? warnings.join(' ') : null,
  })
}
