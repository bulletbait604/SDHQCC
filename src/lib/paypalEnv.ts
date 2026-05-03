/**
 * PayPal REST / SDK environment.
 *
 * Prefer NEXT_PUBLIC_PAYPAL_MODE first (same value in browser + server).
 * Client-side code should use GET /api/paypal-public-config for SDK client ID so Vercel
 * env updates apply without a new build (NEXT_PUBLIC_* is baked into JS at compile time).
 */

function envTrim(s: string | undefined): string {
  if (s === undefined || s === null) return ''
  return String(s).replace(/^\uFEFF/, '').trim()
}

/** Strip wrapping quotes some hosts add to env values */
function normalizePlanIdEnv(v: string | undefined): string {
  let s = envTrim(v)
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  return envTrim(s)
}

/**
 * PayPal Billing **Plan** IDs for subscriptions look like `P-xxxxxxxx` (Dashboard → Subscription plans).
 * **Product** IDs (`PROD-...`) will cause RESOURCE_NOT_FOUND / INVALID_RESOURCE_ID on Subscribe.
 */
export function paypalSubscriptionPlanIdFormatOk(planId: string | undefined | null): boolean {
  const id = typeof planId === 'string' ? planId.trim() : ''
  if (!id) return false
  return /^P-[A-Za-z0-9_-]+$/.test(id)
}

export function isPayPalSandbox(): boolean {
  const m = envTrim(process.env.NEXT_PUBLIC_PAYPAL_MODE) || envTrim(process.env.PAYPAL_MODE)
  return m.toLowerCase() === 'sandbox'
}

export function paypalApiBase(): string {
  return isPayPalSandbox()
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'
}

export function paypalClientCredentials(): { clientId: string | undefined; clientSecret: string | undefined } {
  if (isPayPalSandbox()) {
    return {
      clientId:
        envTrim(process.env.PAYPAL_CLIENT_ID_SANDBOX) ||
        envTrim(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX),
      clientSecret: envTrim(process.env.PAYPAL_CLIENT_SECRET_SANDBOX) || undefined,
    }
  }
  return {
    clientId: envTrim(process.env.PAYPAL_CLIENT_ID) || undefined,
    clientSecret: envTrim(process.env.PAYPAL_CLIENT_SECRET) || undefined,
  }
}

/**
 * Client ID for PayPal JS SDK.
 * Sandbox: ONLY sandbox app IDs — never fall back to live (that forced production checkout).
 * Server may expose PAYPAL_CLIENT_ID_SANDBOX via /api/paypal-public-config for the browser.
 */
export function paypalSdkClientId(): string | undefined {
  if (isPayPalSandbox()) {
    const sid =
      envTrim(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX) ||
      envTrim(process.env.PAYPAL_CLIENT_ID_SANDBOX)
    return sid || undefined
  }
  const live = envTrim(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID)
  return live || undefined
}

/**
 * PayPal **Subscription plan** ID only (Dashboard → Subscription plans — recurring monthly).
 * Used by the Subscribe popup (`intent=subscription`). Not used for Lifetime Pass (one-time order checkout).
 */
export function paypalSdkPlanId(): string | undefined {
  if (isPayPalSandbox()) {
    const p =
      normalizePlanIdEnv(process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID_SANDBOX) ||
      normalizePlanIdEnv(process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID)
    return p || undefined
  }
  const live = normalizePlanIdEnv(process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID)
  return live || undefined
}

/** @deprecated Prefer /api/paypal-public-config in client components (runtime env). */
export function publicPayPalClientId(): string | undefined {
  return paypalSdkClientId()
}

/** @deprecated Prefer /api/paypal-public-config in client components. */
export function publicPayPalPlanId(): string | undefined {
  return paypalSdkPlanId()
}
