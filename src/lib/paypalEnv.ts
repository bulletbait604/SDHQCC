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

/** True only when mode is exactly `sandbox` (case-insensitive). Any other value — including `live` or unset — uses production PayPal APIs. */
export function isPayPalSandbox(): boolean {
  const m = envTrim(process.env.NEXT_PUBLIC_PAYPAL_MODE) || envTrim(process.env.PAYPAL_MODE)
  return m.toLowerCase() === 'sandbox'
}

export function paypalMode(): 'sandbox' | 'live' {
  return isPayPalSandbox() ? 'sandbox' : 'live'
}

export function paypalApiBase(): string {
  return isPayPalSandbox()
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'
}

/**
 * Client ID for PayPal JS SDK and REST OAuth (must be identical — same PayPal app).
 * Sandbox: ONLY sandbox app IDs — never fall back to live (that forced production checkout).
 */
export function paypalSdkClientId(): string | undefined {
  if (isPayPalSandbox()) {
    const sid =
      envTrim(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX) ||
      envTrim(process.env.PAYPAL_CLIENT_ID_SANDBOX)
    return sid || undefined
  }
  const live =
    envTrim(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID) || envTrim(process.env.PAYPAL_CLIENT_ID)
  return live || undefined
}

/**
 * REST OAuth uses the same Client ID as `paypalSdkClientId()` so server and browser always agree.
 */
export function paypalClientCredentials(): { clientId: string | undefined; clientSecret: string | undefined } {
  const clientId = paypalSdkClientId()
  if (isPayPalSandbox()) {
    return {
      clientId,
      clientSecret: envTrim(process.env.PAYPAL_CLIENT_SECRET_SANDBOX) || undefined,
    }
  }
  return {
    clientId,
    clientSecret: envTrim(process.env.PAYPAL_CLIENT_SECRET) || undefined,
  }
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

/** True when sandbox mode uses `NEXT_PUBLIC_PAYPAL_PLAN_ID` because `_SANDBOX` is unset — often a live Plan ID and breaks Subscribe in sandbox. */
export function paypalSandboxUsingGenericPlanFallback(): boolean {
  if (!isPayPalSandbox()) return false
  const explicit = normalizePlanIdEnv(process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID_SANDBOX)
  const generic = normalizePlanIdEnv(process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID)
  return !explicit && !!generic
}

/** @deprecated Prefer /api/paypal-public-config in client components (runtime env). */
export function publicPayPalClientId(): string | undefined {
  return paypalSdkClientId()
}

/** @deprecated Prefer /api/paypal-public-config in client components. */
export function publicPayPalPlanId(): string | undefined {
  return paypalSdkPlanId()
}
