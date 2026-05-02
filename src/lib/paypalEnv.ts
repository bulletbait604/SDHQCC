/**
 * PayPal REST base URL and credentials from PAYPAL_MODE / NEXT_PUBLIC_PAYPAL_MODE.
 */

export function isPayPalSandbox(): boolean {
  const m =
    process.env.PAYPAL_MODE ||
    process.env.NEXT_PUBLIC_PAYPAL_MODE ||
    ''
  return String(m).toLowerCase() === 'sandbox'
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
        process.env.PAYPAL_CLIENT_ID_SANDBOX || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET_SANDBOX,
    }
  }
  return {
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  }
}
