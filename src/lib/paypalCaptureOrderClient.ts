/**
 * Merchant-side capture via API — avoids PayPal JS SDK error:
 * "Buyer access token not present - can not call smart api: .../capture"
 */

export async function captureCheckoutOrderOnServer(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/paypal-capture-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ orderId }),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) return { ok: false, error: data.error || `Request failed (${res.status})` }
  return { ok: true }
}
