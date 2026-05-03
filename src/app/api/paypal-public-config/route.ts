import { NextResponse } from 'next/server'
import {
  isPayPalSandbox,
  paypalClientCredentials,
  paypalSandboxUsingGenericPlanFallback,
  paypalSdkClientId,
  paypalSdkPlanId,
  paypalSubscriptionPlanIdFormatOk,
} from '@/lib/paypalEnv'
import { getPayPalBillingPlan } from '@/lib/paypalServerApi'

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
  if (sandbox && paypalSandboxUsingGenericPlanFallback()) {
    warnings.push(
      'Sandbox mode is falling back to NEXT_PUBLIC_PAYPAL_PLAN_ID because NEXT_PUBLIC_PAYPAL_PLAN_ID_SANDBOX is empty. A live Plan ID will not work in sandbox — create a sandbox billing plan (same Sandbox REST app as your client ID) and set NEXT_PUBLIC_PAYPAL_PLAN_ID_SANDBOX=P-…'
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

  let planResolvedOnPayPal: boolean | null = null
  const secretPresent = !!paypalClientCredentials().clientSecret
  if (planId && paypalSubscriptionPlanIdFormatOk(planId) && secretPresent) {
    const pr = await getPayPalBillingPlan(planId)
    planResolvedOnPayPal = pr.ok
    if (!pr.ok) {
      const msg =
        pr.httpStatus === 404
          ? 'RESOURCE_NOT_FOUND: PayPal has no Billing Plan with this ID for this REST app and environment. Create a plan with the same Sandbox (or Live) app as your Client ID and secret, then set NEXT_PUBLIC_PAYPAL_PLAN_ID_SANDBOX to that P- value.'
          : `PayPal Billing Plans API returned HTTP ${pr.httpStatus ?? 'error'} for this Plan ID — check Client ID, secret, and NEXT_PUBLIC_PAYPAL_MODE.`
      warnings.push(msg)
    }
  }

  return NextResponse.json({
    sandbox,
    clientId,
    planId,
    /** false when planId looks like PROD-xxx / wrong shape — Subscribe will fail at PayPal */
    planIdFormatOk: planId ? paypalSubscriptionPlanIdFormatOk(planId) : null,
    /** null = could not verify (no server secret); false = PayPal returned error / 404 for this P- id */
    planResolvedOnPayPal,
    warning: warnings.length ? warnings.join(' ') : null,
  })
}
