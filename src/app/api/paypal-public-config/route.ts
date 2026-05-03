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

  /** SDK / client-ID issues that affect all PayPal flows (Subscribe, coins, donations). */
  const sdkWarnings: string[] = []
  /** Subscription Billing Plan only — must not appear on coin/donation popups. */
  const subscribePlanWarnings: string[] = []

  if (sandbox && !clientId) {
    sdkWarnings.push(
      'Sandbox mode is active but no sandbox Client ID was found. Set NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX (recommended) or PAYPAL_CLIENT_ID_SANDBOX in Vercel.'
    )
  }
  const { clientId: restClientId, clientSecret: restSecret } = paypalClientCredentials()
  if (sandbox && restClientId && !restSecret) {
    sdkWarnings.push(
      'Set PAYPAL_CLIENT_SECRET_SANDBOX on the server (Vercel env). The subscribe button needs it for OAuth; it is never exposed to the browser.'
    )
  }
  if (!sandbox && restClientId && !restSecret) {
    sdkWarnings.push(
      'Set PAYPAL_CLIENT_SECRET on the server (Vercel env) for the same PayPal app as your Client ID.'
    )
  }
  if (sandbox && paypalSandboxUsingGenericPlanFallback()) {
    subscribePlanWarnings.push(
      'Sandbox mode is falling back to NEXT_PUBLIC_PAYPAL_PLAN_ID because NEXT_PUBLIC_PAYPAL_PLAN_ID_SANDBOX is empty. A live Plan ID will not work in sandbox — create a sandbox billing plan (same Sandbox REST app as your client ID) and set NEXT_PUBLIC_PAYPAL_PLAN_ID_SANDBOX=P-…'
    )
  }
  if (!planId) {
    subscribePlanWarnings.push(
      sandbox
        ? 'Monthly Subscribe: set NEXT_PUBLIC_PAYPAL_PLAN_ID_SANDBOX (or NEXT_PUBLIC_PAYPAL_PLAN_ID) to the Plan ID from PayPal → Subscription plans. Lifetime Pass is a one-time payment — it does not use plan IDs.'
        : 'Monthly Subscribe: set NEXT_PUBLIC_PAYPAL_PLAN_ID to the Plan ID from PayPal → Subscription plans. Lifetime Pass is one-time checkout — no plan ID.'
    )
  }
  if (planId && !paypalSubscriptionPlanIdFormatOk(planId)) {
    subscribePlanWarnings.push(
      'Subscribe uses a Billing Plan ID that starts with P- (PayPal → Subscription plans → copy Plan ID). Values starting with PROD- are Product IDs and will fail with INVALID_RESOURCE_ID.'
    )
  }

  let planResolvedOnPayPal: boolean | null = null
  let planVerifyIssue: 'oauth' | 'not_found' | 'http' | null = null
  let oauthFailureDetail: 'missing_client' | 'missing_secret' | 'unauthorized' | 'other' | null = null
  const secretPresent = !!paypalClientCredentials().clientSecret
  if (planId && paypalSubscriptionPlanIdFormatOk(planId) && secretPresent) {
    const pr = await getPayPalBillingPlan(planId)
    planResolvedOnPayPal = pr.ok
    if (!pr.ok) {
      planVerifyIssue = pr.oauthFailed ? 'oauth' : pr.httpStatus === 404 ? 'not_found' : 'http'
      if (pr.oauthFailed && pr.oauthFailureDetail) oauthFailureDetail = pr.oauthFailureDetail
      const msg = pr.oauthFailed
        ? pr.oauthFailureDetail === 'missing_secret'
          ? 'Could not verify subscription plan: PAYPAL_CLIENT_SECRET_SANDBOX (or live PAYPAL_CLIENT_SECRET) is missing on the server. Add it in Vercel → Environment Variables for this deployment.'
          : pr.oauthFailureDetail === 'missing_client'
            ? 'Could not verify subscription plan: no Client ID for REST OAuth. Set NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX + PAYPAL_CLIENT_ID_SANDBOX (sandbox) or NEXT_PUBLIC_PAYPAL_CLIENT_ID + PAYPAL_CLIENT_ID (live) so server and browser use the same app.'
            : pr.oauthFailureDetail === 'unauthorized'
              ? 'PayPal rejected Client ID + Secret (401/403). Use the secret from the same Developer Dashboard app as your Client ID; regenerate the secret if it was rotated.'
              : 'Could not verify subscription plan: PayPal OAuth failed. Confirm NEXT_PUBLIC_PAYPAL_MODE matches sandbox vs live credentials and that Client ID + Secret belong to one PayPal app.'
        : pr.httpStatus === 404
          ? 'RESOURCE_NOT_FOUND: PayPal has no Billing Plan with this ID for this REST app and environment. Create a plan with the same Sandbox (or Live) app as your Client ID and secret, then set NEXT_PUBLIC_PAYPAL_PLAN_ID_SANDBOX to that P- value.'
          : `PayPal Billing Plans API returned HTTP ${pr.httpStatus ?? 'error'} for this Plan ID — check Client ID, secret, and NEXT_PUBLIC_PAYPAL_MODE.`
      subscribePlanWarnings.push(msg)
    }
  }

  const allWarnings = [...sdkWarnings, ...subscribePlanWarnings]

  return NextResponse.json({
    sandbox,
    clientId,
    planId,
    /** false when planId looks like PROD-xxx / wrong shape — Subscribe will fail at PayPal */
    planIdFormatOk: planId ? paypalSubscriptionPlanIdFormatOk(planId) : null,
    /** null = could not verify (no server secret); false = PayPal returned error / 404 for this P- id */
    planResolvedOnPayPal,
    /** Why plan verification failed — avoid showing RESOURCE_NOT_FOUND when OAuth is the real issue */
    planVerifyIssue,
    /** Sub-reason when planVerifyIssue === oauth */
    oauthFailureDetail,
    /** All warnings (Subscribe popup, diagnostics). */
    warning: allWarnings.length ? allWarnings.join(' ') : null,
    /** One-time checkout only (coins, donations) — excludes subscription plan messages. */
    coinWarning: sdkWarnings.length ? sdkWarnings.join(' ') : null,
  })
}
