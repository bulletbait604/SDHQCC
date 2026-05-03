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
  if (sandbox && !planId) {
    warnings.push(
      'Set NEXT_PUBLIC_PAYPAL_PLAN_ID_SANDBOX to your sandbox billing plan ID for subscriptions.'
    )
  }

  return NextResponse.json({
    sandbox,
    clientId,
    planId,
    warning: warnings.length ? warnings.join(' ') : null,
  })
}
