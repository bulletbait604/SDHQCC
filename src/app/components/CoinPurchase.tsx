'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Coins, X, Loader2 } from 'lucide-react'
import { usePayPalPublicConfig } from '@/hooks/usePayPalPublicConfig'
import { captureCheckoutOrderOnServer } from '@/lib/paypalCaptureOrderClient'

interface CoinPackage {
  id: 'small' | 'medium' | 'large'
  coins: number
  price: number
  label: string
}

/** Must match /api/coins/purchase COIN_PACKAGES and paypal-webhook custom_id parsing */
const COIN_PACKAGES: CoinPackage[] = [
  { id: 'small', coins: 12, price: 5, label: 'Starter Pack' },
  { id: 'medium', coins: 35, price: 10, label: 'Value Pack' },
  { id: 'large', coins: 100, price: 20, label: 'Pro Pack' },
]

interface CoinPurchaseProps {
  isOpen: boolean
  onClose: () => void
  /** Kick login username — used in PayPal custom_id (must match webhook + coinBalances userId) */
  userId: string
  darkMode?: boolean
}

/**
 * Coin checkout uses the same PayPal JS SDK flow as Lifetime membership:
 * client ID from GET /api/paypal-public-config (runtime env — not baked into the bundle).
 * Webhook credits coins using custom_id: usernameLower|coins|packageType|coinCount|price
 */
export default function CoinPurchase({ isOpen, onClose, userId, darkMode = false }: CoinPurchaseProps) {
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sdkReady, setSdkReady] = useState(false)
  const paypalContainerRef = useRef<HTMLDivElement>(null)
  const { config: paypalCfg, loading: paypalCfgLoading, error: paypalCfgError } = usePayPalPublicConfig()

  // Load PayPal SDK once (same pattern as lifetime membership on page.tsx)
  useEffect(() => {
    if (!isOpen) return

    const clientId = paypalCfg?.clientId
    if (!clientId) {
      if (!paypalCfgLoading) {
        setError(paypalCfgError || 'PayPal is not configured for this mode.')
      }
      setSdkReady(false)
      return
    }
    setError('')

    type Win = Window & { paypal_coins?: typeof window.paypal }
    const w = window as Win

    if (typeof window !== 'undefined' && w.paypal_coins) {
      setSdkReady(true)
      return
    }

    const existing = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[data-sdhq-paypal-coins-sdk]')
    ).find((s) => s.getAttribute('data-paypal-client-id') === clientId)
    if (existing) {
      if (w.paypal_coins) setSdkReady(true)
      else existing.addEventListener('load', () => setSdkReady(true), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=CAD&disable-funding=paylater`
    script.setAttribute('data-sdhq-paypal-coins-sdk', '1')
    script.setAttribute('data-paypal-client-id', clientId)
    script.setAttribute('data-namespace', 'paypal_coins')
    script.setAttribute('data-sdk-integration-source', 'button-factory')
    script.onload = () => setSdkReady(true)
    script.onerror = () => setError('Failed to load PayPal.')
    document.body.appendChild(script)
  }, [isOpen, paypalCfg?.clientId, paypalCfgLoading, paypalCfgError])

  useEffect(() => {
    if (!isOpen || !sdkReady || !selectedPackage || !userId.trim()) return
    const container = paypalContainerRef.current
    type Win = Window & { paypal_coins?: typeof window.paypal }
    const paypalSdk = (window as Win).paypal_coins
    if (!container || !paypalSdk) return

    container.innerHTML = ''
    setError('')

    const uid = userId.replace(/^@/, '').toLowerCase()
    /** Mirrors src/app/api/coins/purchase/route.ts custom_id */
    const customId = `${uid}|coins|${selectedPackage.id}|${selectedPackage.coins}|${selectedPackage.price}`

    const buttons = paypalSdk.Buttons({
      style: {
        shape: 'pill',
        color: 'gold',
        layout: 'vertical',
        label: 'pay',
      },
      createOrder: (_data: unknown, actions: { order: { create: (o: unknown) => Promise<string> } }) => {
        return actions.order.create({
          purchase_units: [
            {
              amount: {
                currency_code: 'CAD',
                value: Number(selectedPackage.price).toFixed(2),
              },
              description: `${selectedPackage.coins} coins — ${selectedPackage.label}`,
              custom_id: customId,
            },
          ],
        })
      },
      onApprove: async (data: { orderID?: string }) => {
        const orderID = data.orderID
        if (!orderID) {
          setError('Missing order ID from PayPal.')
          return
        }
        try {
          setLoading(true)
          const cap = await captureCheckoutOrderOnServer(orderID)
          if (!cap.ok) {
            setError(cap.error || 'Payment capture failed')
            setLoading(false)
            return
          }
          const fulfill = await fetch('/api/coins/complete-purchase', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: orderID }),
          })
          const fulfillJson = (await fulfill.json().catch(() => ({}))) as { error?: string; coins?: number }
          if (!fulfill.ok) {
            setError(
              fulfillJson.error ||
                'Payment captured but coins were not credited yet. Refresh in a moment; if your balance is still wrong, contact support with your PayPal receipt.'
            )
            setLoading(false)
            return
          }
          setLoading(false)
          setTimeout(() => window.location.reload(), 150)
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Payment capture failed'
          setError(msg)
          setLoading(false)
        }
      },
      onError: (err: { message?: string }) => {
        setError(err?.message || 'PayPal error')
        setLoading(false)
      },
      onCancel: () => {
        setLoading(false)
      },
    })

    buttons.render(container).catch((err: unknown) => {
      console.error('PayPal coin buttons render failed:', err)
      setError('Could not start PayPal checkout.')
    })

    return () => {
      container.innerHTML = ''
    }
    // onClose is not used in this effect; do not add it here — a new parent callback each render
    // would re-run this effect, tear down and re-render PayPal buttons, and make them unclickable.
  }, [isOpen, sdkReady, selectedPackage, userId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50">
      <div className="flex min-h-full items-center justify-center p-4 py-8">
        <div
          className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} w-full max-w-md max-h-[min(90vh,100dvh-2rem)] overflow-y-auto rounded-xl p-6 shadow-2xl`}
        >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Coins className={`w-6 h-6 ${darkMode ? 'text-yellow-400' : 'text-yellow-500'}`} />
            <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Buy Coins</h3>
          </div>
          <button
            type="button"
            onClick={() => !loading && onClose()}
            className={`p-1 rounded-full hover:bg-gray-200 ${darkMode ? 'hover:bg-sdhq-dark-700 text-white' : 'text-gray-600'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Purchase coins to use our AI-powered tools. Coins are credited after PayPal confirms payment (same flow as lifetime
          membership).
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        <div className="space-y-3">
          {COIN_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              onClick={() => setSelectedPackage(pkg)}
              disabled={loading}
              className={`w-full p-4 rounded-lg border-2 transition-all ${
                selectedPackage?.id === pkg.id
                  ? 'border-sdhq-cyan-500 bg-sdhq-cyan-500/10'
                  : darkMode
                    ? 'border-sdhq-dark-600 hover:border-sdhq-cyan-500/50'
                    : 'border-gray-200 hover:border-sdhq-cyan-300'
              } ${darkMode ? 'bg-sdhq-dark-700' : 'bg-gray-50'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${darkMode ? 'bg-sdhq-dark-600' : 'bg-white'}`}>
                    <Coins className={`w-5 h-5 ${darkMode ? 'text-yellow-400' : 'text-yellow-500'}`} />
                  </div>
                  <div className="text-left">
                    <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{pkg.coins} Coins</p>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{pkg.label}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                    ${pkg.price}
                  </p>
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>CAD</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 min-h-[120px]">
          {paypalCfgLoading ? (
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading PayPal configuration…</p>
          ) : null}
          {paypalCfgError ? (
            <p className="text-sm text-red-500">{paypalCfgError}</p>
          ) : null}
          {!paypalCfgLoading && !paypalCfg?.clientId && !paypalCfgError ? (
            <p className={`text-sm ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>
              Missing PayPal client ID for this mode — set NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX (sandbox) or
              NEXT_PUBLIC_PAYPAL_CLIENT_ID (live) on the server.
            </p>
          ) : null}
          {paypalCfg?.coinWarning ? (
            <p className={`text-sm ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>{paypalCfg.coinWarning}</p>
          ) : null}

          {selectedPackage && sdkReady && (
            <>
              <p className={`text-xs mb-3 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Pay with PayPal — {selectedPackage.coins} coins for ${selectedPackage.price} CAD
              </p>
              <div ref={paypalContainerRef} className="flex flex-col items-stretch" />
            </>
          )}

          {selectedPackage && !sdkReady && !error && !paypalCfgLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading PayPal…
            </div>
          )}
        </div>

        <Button
          variant="outline"
          type="button"
          onClick={() => onClose()}
          disabled={loading}
          className={`w-full mt-4 ${darkMode ? 'border-sdhq-dark-600 text-white' : ''}`}
        >
          Cancel
        </Button>

        <p className={`mt-4 text-xs text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          Uses the same PayPal client ID as lifetime membership. Server secrets are only needed for webhooks capturing orders.
        </p>
        </div>
      </div>
    </div>
  )
}
