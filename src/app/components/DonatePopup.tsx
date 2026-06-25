'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { captureCheckoutOrderOnServer } from '@/lib/paypalCaptureOrderClient'
import type { PayPalPublicConfig } from '@/hooks/usePayPalPublicConfig'
import type { KickUser } from '@/lib/home/types'
import PayPalModalShell from '@/app/components/PayPalModalShell'

export interface DonatePopupProps {
  darkMode: boolean
  user: KickUser
  paypalCfg: PayPalPublicConfig | null
  paypalCfgLoading: boolean
  paypalCfgError: string | null
  onClose: () => void
}

export default function DonatePopup({
  darkMode,
  user,
  paypalCfg,
  paypalCfgLoading,
  paypalCfgError,
  onClose,
}: DonatePopupProps) {
  const [donateAmount, setDonateAmount] = useState(2)
  const [paypalDonateSdkReady, setPaypalDonateSdkReady] = useState(false)
  const donateAmountRef = useRef(donateAmount)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    donateAmountRef.current = donateAmount
    onCloseRef.current = onClose
  }, [donateAmount, onClose])

  useEffect(() => {
    const clientId = paypalCfg?.clientId
    if (!clientId) return

    type Win = Window & { paypal_donate?: typeof window.paypal }
    const w = window as Win
    if (w.paypal_donate) {
      setPaypalDonateSdkReady(true)
      return
    }

    const existing = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[data-sdhq-paypal-donate-sdk]')
    ).find((s) => s.getAttribute('data-paypal-client-id') === clientId)
    if (existing) {
      if (w.paypal_donate) setPaypalDonateSdkReady(true)
      else existing.addEventListener('load', () => setPaypalDonateSdkReady(true), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&disable-funding=paylater`
    script.setAttribute('data-sdhq-paypal-donate-sdk', '1')
    script.setAttribute('data-paypal-client-id', clientId)
    script.setAttribute('data-namespace', 'paypal_donate')
    script.setAttribute('data-sdk-integration-source', 'button-factory')
    script.onload = () => setPaypalDonateSdkReady(true)
    script.onerror = () => console.error('PayPal donate SDK failed to load')
    document.body.appendChild(script)
  }, [paypalCfg?.clientId])

  useEffect(() => {
    if (!paypalDonateSdkReady || !user) return

    const container = document.getElementById('paypal-donate-button-container')
    type Win = Window & { paypal_donate?: typeof window.paypal }
    const paypalSdk = (window as Win).paypal_donate
    if (!container || !paypalSdk) return

    container.innerHTML = ''

    const buttons = paypalSdk.Buttons({
      style: { shape: 'pill', color: 'gold', layout: 'vertical', label: 'pay' },
      createOrder: (
        _data: unknown,
        actions: { order: { create: (payload: unknown) => Promise<string> } }
      ) => {
        const amt = donateAmountRef.current
        if (!amt || amt < 1) {
          return Promise.reject(new Error('Please enter at least $1 USD.'))
        }
        const uid = user.username.replace(/^@/, '').toLowerCase()
        return actions.order.create({
          purchase_units: [
            {
              amount: { currency_code: 'USD', value: amt.toFixed(2) },
              description: 'Donation to Stream Dreams Creator Corner',
              custom_id: `${uid}|donation|${amt.toFixed(2)}|USD`,
            },
          ],
        })
      },
      onApprove: async (data: { orderID?: string }) => {
        const orderID = data.orderID
        if (!orderID) {
          alert('PayPal did not return an order ID.')
          return
        }
        const cap = await captureCheckoutOrderOnServer(orderID)
        if (!cap.ok) {
          alert(cap.error || 'Could not complete donation. Try again or contact support.')
          return
        }
        alert('Thank you for your donation!')
        onCloseRef.current()
      },
      onError: (err: { message?: string }) => {
        console.error('[Donate]', err)
        alert(err?.message || 'PayPal could not process this donation.')
      },
      onCancel: () => {},
    })

    buttons.render(container).catch((err: unknown) => {
      console.error('PayPal donate buttons render failed:', err)
    })

    return () => {
      container.innerHTML = ''
    }
  }, [paypalDonateSdkReady, user, donateAmount])

  return (
    <PayPalModalShell darkMode={darkMode} title="Support Stream Dreams" onClose={onClose}>
      <p className={`mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
        Your donation helps us keep the lights on and continue improving Stream Dreams Creator Corner for
        everyone.
      </p>
      <div className="space-y-4">
        {paypalCfgLoading ? (
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading PayPal configuration…</p>
        ) : null}
        {paypalCfgError ? <p className="text-sm text-red-500">{paypalCfgError}</p> : null}
        {!paypalCfgLoading && !paypalCfg?.clientId && !paypalCfgError ? (
          <p className={`text-sm ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>
            PayPal is not configured for this mode (set NEXT_PUBLIC_PAYPAL_MODE and matching client ID on the
            server).
          </p>
        ) : null}
        {paypalCfg?.coinWarning ? (
          <p className={`text-sm ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>{paypalCfg.coinWarning}</p>
        ) : null}

        <div>
          <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Donation amount (USD)
          </label>
          <div className="flex items-center space-x-2">
            <span className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>$</span>
            <input
              type="number"
              min={1}
              step={1}
              value={donateAmount}
              onChange={(e) => setDonateAmount(Math.max(1, parseFloat(e.target.value) || 0))}
              className={`flex-1 px-3 py-2 rounded-lg border ${
                darkMode ? 'bg-sdhq-dark-700 border-sdhq-dark-600 text-white' : 'bg-white border-gray-300 text-gray-900'
              }`}
              placeholder="Amount in USD"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[2, 5, 10, 25].map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setDonateAmount(amount)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                donateAmount === amount
                  ? 'bg-pink-500 text-white'
                  : darkMode
                    ? 'bg-sdhq-dark-700 text-gray-300 hover:bg-sdhq-dark-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ${amount}
            </button>
          ))}
        </div>

        {paypalCfg?.clientId ? (
          <>
            {!paypalDonateSdkReady ? (
              <p className={`text-sm text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading PayPal…</p>
            ) : null}
            <div id="paypal-donate-button-container" className="min-h-[48px] w-full" />
          </>
        ) : null}

        <Button
          variant="outline"
          onClick={onClose}
          className={`w-full ${darkMode ? 'border-sdhq-dark-600 text-white' : ''}`}
        >
          Cancel
        </Button>
      </div>
      <p className={`mt-4 text-xs text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        Opens PayPal to complete your donation in USD. Thank you for your support!
      </p>
    </PayPalModalShell>
  )
}
