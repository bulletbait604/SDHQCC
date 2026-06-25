'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { captureCheckoutOrderOnServer } from '@/lib/paypalCaptureOrderClient'
import type { PayPalPublicConfig } from '@/hooks/usePayPalPublicConfig'
import type { KickUser } from '@/lib/home/types'
import PayPalModalShell from '@/app/components/PayPalModalShell'

export interface LifetimePassPopupProps {
  darkMode: boolean
  user: KickUser
  paypalCfg: PayPalPublicConfig | null
  lifetimeLocalPrice: number
  checkoutCurrency: string
  currencyQuoteNote: string | null
  onClose: () => void
}

export default function LifetimePassPopup({
  darkMode,
  user,
  paypalCfg,
  lifetimeLocalPrice,
  checkoutCurrency,
  currencyQuoteNote,
  onClose,
}: LifetimePassPopupProps) {
  const [paypalLifetimeLoaded, setPaypalLifetimeLoaded] = useState(false)

  useEffect(() => {
    return () => {
      setPaypalLifetimeLoaded(false)
      const el = document.getElementById('paypal-lifetime-button-container')
      if (el) el.innerHTML = ''
    }
  }, [])

  useEffect(() => {
    if (paypalLifetimeLoaded || !user) return

    const paypalClientId = paypalCfg?.clientId
    if (!paypalClientId) {
      console.error('PayPal Client ID not configured')
      return
    }

    type Win = Window & { paypal_lifetime?: typeof window.paypal }
    const w = window as Win

    console.log(`PayPal Lifetime: Loading SDK in ${paypalCfg?.sandbox ? 'SANDBOX' : 'LIVE'} mode`)

    const mountLifetimeButtons = () => {
      if (!w.paypal_lifetime || !user) return
      try {
        const buttons = w.paypal_lifetime.Buttons({
          style: {
            shape: 'pill',
            color: 'blue',
            layout: 'horizontal',
            label: 'pay',
          },
          createOrder: function (
            _data: unknown,
            actions: { order: { create: (payload: unknown) => Promise<string> } }
          ) {
            return actions.order.create({
              purchase_units: [
                {
                  amount: {
                    value: lifetimeLocalPrice.toFixed(2),
                    currency_code: checkoutCurrency,
                  },
                  description: 'Stream Dreams Creator Corner Lifetime Membership',
                  custom_id: `${user.username.replace(/^@/, '').toLowerCase()}|lifetime|${lifetimeLocalPrice.toFixed(2)}|${checkoutCurrency}`,
                },
              ],
            })
          },
          onApprove: async function (data: { orderID?: string }) {
            const orderID = data.orderID
            console.log('Lifetime payment approved:', orderID)
            if (!orderID) {
              alert('PayPal did not return an order ID.')
              return
            }
            const cap = await captureCheckoutOrderOnServer(orderID)
            if (!cap.ok) {
              alert(cap.error || 'Could not complete payment. Try again.')
              return
            }
            const done = await fetch('/api/lifetime/complete-purchase', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: orderID }),
            })
            const doneJson = (await done.json().catch(() => ({}))) as { error?: string }
            if (!done.ok) {
              alert(
                doneJson.error ||
                  'Payment went through but lifetime access was not applied. Refresh the page, or contact support with your PayPal receipt.'
              )
              return
            }
            setTimeout(() => window.location.reload(), 150)
          },
          onError: function (err: { message?: string }) {
            console.error('PayPal lifetime button error:', err)
            alert('PayPal error: ' + (err.message || 'Unknown error'))
          },
        })
        if (buttons.isEligible()) {
          buttons.render('#paypal-lifetime-button-container')
          setPaypalLifetimeLoaded(true)
        } else {
          console.error('PayPal: Lifetime button not eligible')
          alert(
            'PayPal checkout is not available. In sandbox, log in with a Personal buyer account, not your Business (seller) account.'
          )
        }
      } catch (e) {
        console.error('PayPal lifetime Buttons failed:', e)
        alert('Failed to initialize PayPal checkout.')
      }
    }

    if (w.paypal_lifetime) {
      mountLifetimeButtons()
      return
    }

    const existing = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[data-sdhq-paypal-lifetime-sdk]')
    ).find(
      (s) =>
        s.getAttribute('data-paypal-client-id') === paypalClientId &&
        s.getAttribute('data-paypal-currency') === checkoutCurrency
    )

    if (existing) {
      const onLoad = () => mountLifetimeButtons()
      existing.addEventListener('load', onLoad, { once: true })
      if (w.paypal_lifetime) onLoad()
      return () => existing.removeEventListener('load', onLoad)
    }

    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paypalClientId)}&currency=${encodeURIComponent(checkoutCurrency)}&disable-funding=paylater`
    script.setAttribute('data-sdk-integration-source', 'button-factory')
    script.setAttribute('data-sdhq-paypal-lifetime-sdk', '1')
    script.setAttribute('data-paypal-client-id', paypalClientId)
    script.setAttribute('data-paypal-currency', checkoutCurrency)
    script.setAttribute('data-namespace', 'paypal_lifetime')
    script.onload = () => mountLifetimeButtons()
    script.onerror = () => console.error('PayPal lifetime SDK failed to load')
    document.body.appendChild(script)

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script)
    }
  }, [user, paypalLifetimeLoaded, paypalCfg?.clientId, paypalCfg?.sandbox, checkoutCurrency, lifetimeLocalPrice])

  return (
    <PayPalModalShell darkMode={darkMode} title="Lifetime Pass" onClose={onClose}>
      <div className="space-y-4">
        <p className={`text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Get unlimited access to all current and upcoming features with a single one-time payment of{' '}
          {lifetimeLocalPrice.toLocaleString(undefined, { style: 'currency', currency: checkoutCurrency })}.
        </p>
        <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          This charges once through PayPal checkout — it is not a subscription plan and does not use{' '}
          <span className="font-mono text-[11px]">NEXT_PUBLIC_PAYPAL_PLAN_ID</span>.
        </p>

        <div
          className={`p-4 rounded-lg border ${darkMode ? 'border-sdhq-cyan-500 bg-sdhq-dark-700' : 'border-sdhq-cyan-500 bg-gray-50'}`}
        >
          <p className={`text-sm mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>PayPal one-time checkout:</p>
          <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {lifetimeLocalPrice.toLocaleString(undefined, { style: 'currency', currency: checkoutCurrency })} - Lifetime
            Access
          </p>
          {checkoutCurrency !== 'CAD' ? (
            <p className={`text-xs mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              {currencyQuoteNote || 'Exchange rates are estimated and can shift slightly at payment time.'}
            </p>
          ) : null}
        </div>

        <div id="paypal-lifetime-button-container" className="w-full" />
        {paypalCfg?.sandbox ? (
          <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
            Sandbox: pay with a <span className="font-semibold">Personal</span> buyer sandbox account, not the Business
            (seller) account for your REST app.
          </p>
        ) : null}

        <Button
          variant="outline"
          onClick={onClose}
          className={`w-full ${darkMode ? 'border-sdhq-dark-600 text-white' : ''}`}
        >
          Close
        </Button>
      </div>
    </PayPalModalShell>
  )
}
