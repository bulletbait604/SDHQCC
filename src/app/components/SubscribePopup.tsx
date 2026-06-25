'use client'

import { useEffect, useRef, useState } from 'react'
import { Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PayPalPublicConfig } from '@/hooks/usePayPalPublicConfig'
import type { KickUser } from '@/lib/home/types'
import PayPalModalShell from '@/app/components/PayPalModalShell'

export interface SubscribePopupProps {
  darkMode: boolean
  user: KickUser
  paypalCfg: PayPalPublicConfig | null
  paypalCfgLoading: boolean
  paypalCfgError: string | null
  subscriptionLocalPrice: number
  checkoutCurrency: string
  lifetimeLocalPrice: number
  onClose: () => void
  onSubscriptionApproved: (subscriptionId: string) => void
  onSwitchToLifetime: () => void
  onLifetimeCheckout: () => void
}

export default function SubscribePopup({
  darkMode,
  user,
  paypalCfg,
  paypalCfgLoading,
  paypalCfgError,
  subscriptionLocalPrice,
  checkoutCurrency,
  lifetimeLocalPrice,
  onClose,
  onSubscriptionApproved,
  onSwitchToLifetime,
  onLifetimeCheckout,
}: SubscribePopupProps) {
  const [paypalLoaded, setPaypalLoaded] = useState(false)
  const onCloseRef = useRef(onClose)
  const onSubscriptionApprovedRef = useRef(onSubscriptionApproved)

  useEffect(() => {
    onCloseRef.current = onClose
    onSubscriptionApprovedRef.current = onSubscriptionApproved
  }, [onClose, onSubscriptionApproved])

  useEffect(() => {
    return () => {
      setPaypalLoaded(false)
      const el = document.getElementById('paypal-button-container')
      if (el) el.innerHTML = ''
    }
  }, [])

  useEffect(() => {
    if (paypalLoaded) return
    if (paypalCfgLoading) return

    const paypalClientId = paypalCfg?.clientId
    const planId = paypalCfg?.planId

    if (!paypalClientId || !planId) {
      console.error('PayPal: client ID or plan ID missing — check /api/paypal-public-config and Vercel env.')
      return
    }
    if (paypalCfg?.planIdFormatOk === false) {
      console.error('PayPal: Plan ID must start with P- (billing plan), not PROD-. Skipping Subscribe button.')
      return
    }
    if (paypalCfg?.planResolvedOnPayPal === false) {
      console.error(
        'PayPal: Plan ID not found for this REST app / environment — fix NEXT_PUBLIC_PAYPAL_PLAN_ID_SANDBOX (sandbox) or create plan with same app. Skipping Subscribe button.'
      )
      return
    }

    let cancelled = false

    type Win = Window & { paypal_subscribe?: typeof window.paypal }
    const w = window as Win

    console.log(`PayPal: Loading subscription SDK in ${paypalCfg?.sandbox ? 'SANDBOX' : 'LIVE'} mode`)

    const mountSubscribeButtons = () => {
      if (cancelled) return
      const container = document.getElementById('paypal-button-container')
      if (!container) {
        console.error('PayPal: #paypal-button-container not in DOM')
        return
      }
      if (!w.paypal_subscribe || !user) {
        console.error('PayPal: paypal_subscribe SDK or user not available')
        return
      }
      container.innerHTML = ''
      try {
        const buttons = w.paypal_subscribe.Buttons({
          style: {
            shape: 'pill',
            color: 'blue',
            layout: 'horizontal',
            label: 'subscribe',
          },
          createSubscription: function (_data: unknown, actions: { subscription: { create: (payload: unknown) => Promise<string> } }) {
            const uid = user.username.replace(/^@/, '').toLowerCase()
            console.log('PayPal: Creating subscription with plan:', planId)
            return actions.subscription
              .create({
                plan_id: planId,
                custom_id: uid,
              })
              .catch((err: unknown) => {
                console.error('PayPal: Subscription creation failed:', err)
                const msg = err instanceof Error ? err.message : String(err)
                const invalidPlan = /RESOURCE_NOT_FOUND|INVALID_RESOURCE_ID/i.test(msg)
                alert(
                  invalidPlan
                    ? 'PayPal could not find this plan ID (RESOURCE_NOT_FOUND).\n\nUse the Billing Plan ID that starts with P- from PayPal Dashboard → Subscription plans (same Sandbox/Live as your client ID).\nDo not use a Product ID (PROD-…).\nUpdate NEXT_PUBLIC_PAYPAL_PLAN_ID_SANDBOX (or _PLAN_ID for live) and redeploy.'
                    : 'Failed to create subscription. Please try again.'
                )
                throw err
              })
          },
          onApprove: function (data: { subscriptionID?: string }) {
            console.log('Subscription approved:', data.subscriptionID)
            onCloseRef.current()
            try {
              const paypalWindows = window.open('', 'paypal')
              if (paypalWindows && !paypalWindows.closed) paypalWindows.close()
              const sdkWindows = window.open('', '__paypalSDK__')
              if (sdkWindows && !sdkWindows.closed) sdkWindows.close()
            } catch (e) {
              console.log('Could not auto-close PayPal window:', e)
            }
            if (data.subscriptionID) onSubscriptionApprovedRef.current(data.subscriptionID)
          },
          onError: function (err: { message?: string }) {
            console.error('PayPal button error:', err)
            const m = err?.message || 'Unknown error'
            const invalidPlan = /RESOURCE_NOT_FOUND|INVALID_RESOURCE_ID/i.test(m)
            alert(
              invalidPlan
                ? `${m}\n\nIf this mentions INVALID_RESOURCE_ID: set env to the Billing Plan ID (P-…) from Subscription plans, not PROD-. Same Sandbox app as your client ID.`
                : 'PayPal button error: ' + m
            )
          },
          onCancel: function () {
            console.log('PayPal subscription cancelled by user')
          },
        })

        const eligible = buttons.isEligible()
        if (!eligible) {
          console.warn('PayPal: Subscription Buttons reported not eligible — attempting render anyway (check plan ID & currency)')
        }

        const renderResult = buttons.render(container) as unknown
        const finishOk = () => {
          if (!cancelled) {
            console.log('PayPal: Subscription button rendered')
            setPaypalLoaded(true)
          }
        }
        const finishErr = (err: unknown) => {
          console.error('PayPal: Subscription render failed:', err)
          if (!cancelled) {
            alert(
              'Could not show the PayPal Subscribe button. Confirm NEXT_PUBLIC_PAYPAL_PLAN_ID (or SANDBOX) matches a subscription plan for this client ID and currency (CAD).'
            )
          }
        }
        if (renderResult && typeof (renderResult as Promise<void>).then === 'function') {
          ;(renderResult as Promise<void>).then(finishOk).catch(finishErr)
        } else {
          finishOk()
        }
      } catch (err) {
        console.error('PayPal: Error creating subscription buttons:', err)
        alert('Failed to initialize PayPal. Please try again.')
      }
    }

    const scheduleMount = () => {
      if (cancelled) return
      requestAnimationFrame(() => {
        if (cancelled) return
        mountSubscribeButtons()
      })
    }

    if (w.paypal_subscribe) {
      scheduleMount()
      return () => {
        cancelled = true
      }
    }

    const existing = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[data-sdhq-paypal-subscribe-sdk]')
    ).find((s) => s.getAttribute('data-paypal-client-id') === paypalClientId)

    if (existing) {
      const onLoad = () => scheduleMount()
      existing.addEventListener('load', onLoad, { once: true })
      if (w.paypal_subscribe) scheduleMount()
      return () => {
        cancelled = true
        existing.removeEventListener('load', onLoad)
      }
    }

    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      paypalClientId
    )}&components=buttons&vault=true&intent=subscription&currency=CAD&disable-funding=paylater`
    script.setAttribute('data-sdk-integration-source', 'button-factory')
    script.setAttribute('data-sdhq-paypal-subscribe-sdk', '1')
    script.setAttribute('data-paypal-client-id', paypalClientId)
    script.setAttribute('data-namespace', 'paypal_subscribe')
    script.onload = () => scheduleMount()
    script.onerror = () => {
      console.error('PayPal: Failed to load subscription SDK')
      alert('Failed to load PayPal. Please check your internet connection and try again.')
    }
    document.body.appendChild(script)

    return () => {
      cancelled = true
      if (script.parentNode) script.parentNode.removeChild(script)
    }
  }, [
    user,
    paypalLoaded,
    paypalCfgLoading,
    paypalCfg?.clientId,
    paypalCfg?.planId,
    paypalCfg?.sandbox,
    paypalCfg?.planIdFormatOk,
    paypalCfg?.planResolvedOnPayPal,
  ])

  return (
    <PayPalModalShell darkMode={darkMode} title="Unlock Premium Features" onClose={onClose}>
      <div className="space-y-4">
        <p className={`text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Subscribe to unlock all premium features for{' '}
          {subscriptionLocalPrice.toLocaleString(undefined, { style: 'currency', currency: checkoutCurrency })}
          /month.
        </p>

        <div
          className={`p-4 rounded-lg border ${darkMode ? 'border-sdhq-cyan-500 bg-sdhq-dark-700' : 'border-sdhq-cyan-500 bg-gray-50'}`}
        >
          <p className={`text-sm mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            PayPal Subscription plan (monthly):
          </p>
          <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {subscriptionLocalPrice.toLocaleString(undefined, { style: 'currency', currency: checkoutCurrency })} / month
            — Premium Access
          </p>
          {checkoutCurrency !== 'CAD' ? (
            <p className={`text-xs mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              Final subscription charge is billed in CAD by the existing PayPal plan.
            </p>
          ) : null}
        </div>

        {paypalCfgLoading ? (
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading PayPal configuration…</p>
        ) : null}
        {paypalCfgError ? <p className="text-sm text-red-500">{paypalCfgError}</p> : null}
        {paypalCfg?.warning ? (
          <p className={`text-sm ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>{paypalCfg.warning}</p>
        ) : null}
        {paypalCfg?.planIdFormatOk === false ? (
          <p className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-700'}`}>
            Plan ID must be a Billing Plan ID starting with <span className="font-mono">P-</span> (PayPal → Subscription
            plans). <span className="font-mono">PROD-</span> product IDs will fail with INVALID_RESOURCE_ID.
          </p>
        ) : null}
        {paypalCfg?.planResolvedOnPayPal === false ? (
          <p className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-700'}`}>
            {paypalCfg?.planVerifyIssue === 'oauth' ? (
              <>
                {paypalCfg?.oauthFailureDetail === 'unauthorized' ? (
                  <>
                    PayPal rejected the server credentials (401/403). The Secret must belong to the <em>same</em>{' '}
                    Developer Dashboard app as the Client ID. Regenerate the app secret in the dashboard and update{' '}
                    <span className="font-mono text-[11px]">PAYPAL_CLIENT_SECRET_SANDBOX</span> (or live{' '}
                    <span className="font-mono text-[11px]">PAYPAL_CLIENT_SECRET</span>) in Vercel.
                  </>
                ) : paypalCfg?.oauthFailureDetail === 'missing_secret' ? (
                  <>
                    Add the server-only secret:{' '}
                    <span className="font-mono text-[11px]">PAYPAL_CLIENT_SECRET_SANDBOX</span> for sandbox or{' '}
                    <span className="font-mono text-[11px]">PAYPAL_CLIENT_SECRET</span> for live in your deployment env
                    (Production + Preview). It is required for OAuth but never sent to the browser.
                  </>
                ) : paypalCfg?.oauthFailureDetail === 'missing_client' ? (
                  <>
                    No Client ID for REST OAuth on the server. Set{' '}
                    <span className="font-mono text-[11px]">NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX</span> and/or{' '}
                    <span className="font-mono text-[11px]">PAYPAL_CLIENT_ID_SANDBOX</span> (sandbox) so they match the
                    PayPal app you use for Subscribe.
                  </>
                ) : (
                  <>
                    PayPal OAuth failed. Confirm <span className="font-mono text-[11px]">NEXT_PUBLIC_PAYPAL_MODE</span>{' '}
                    matches sandbox vs live, and that <span className="font-mono text-[11px]">PAYPAL_CLIENT_SECRET_*</span>{' '}
                    pairs with the same app as your Client ID.
                  </>
                )}
              </>
            ) : (
              <>
                PayPal cannot load this Plan ID for your current app (
                <span className="font-mono">RESOURCE_NOT_FOUND</span>).
              </>
            )}
            {paypalCfg?.planVerifyIssue === 'oauth' ? null : paypalCfg?.sandbox ? (
              <>
                {' '}
                Set <span className="font-mono text-[11px]">NEXT_PUBLIC_PAYPAL_PLAN_ID_SANDBOX</span> to a{' '}
                <span className="font-mono">P-</span> plan created with the <em>same</em> Sandbox REST app as your Client
                ID (Developer Dashboard). Do not reuse a live plan ID. Run{' '}
                <span className="font-mono text-[11px]">npm run create-paypal-plan:sandbox</span> (or{' '}
                <span className="font-mono text-[11px]">PAYPAL_MODE=sandbox npm run create-paypal-plan</span>) if needed.
              </>
            ) : (
              <>
                {' '}
                Set <span className="font-mono text-[11px]">NEXT_PUBLIC_PAYPAL_PLAN_ID</span> to a{' '}
                <span className="font-mono">P-</span> billing plan from PayPal → Subscription plans for your <em>live</em>{' '}
                REST app (same Client ID/secret). Sandbox plan IDs do not work in live mode.
              </>
            )}
          </p>
        ) : null}
        {!paypalCfgLoading && !paypalCfg?.clientId && !paypalCfgError ? (
          <p className={`text-sm ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>
            PayPal client ID is missing for this mode. Set sandbox or live IDs in your deployment env and redeploy if
            needed.
          </p>
        ) : null}

        <div id="paypal-button-container" className="w-full" />
        {paypalCfg?.sandbox ? (
          <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
            Sandbox testing: use a <span className="font-semibold">Personal</span> buyer account (PayPal Developer →
            Sandbox accounts). Do not pay with the Business account linked to your app — PayPal will block it.
          </p>
        ) : null}

        <div className={`text-center pt-2 border-t ${darkMode ? 'border-sdhq-dark-600' : 'border-gray-200'}`}>
          <p className={`text-sm mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Want to pay once and never worry about subscriptions again?
          </p>
          <Button
            variant="outline"
            onClick={onSwitchToLifetime}
            className={`w-full ${darkMode ? 'border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10' : 'border-yellow-500 text-yellow-600 hover:bg-yellow-50'}`}
          >
            <Crown className="w-4 h-4 mr-2" />
            Want Lifetime Access? (
            {lifetimeLocalPrice.toLocaleString(undefined, { style: 'currency', currency: checkoutCurrency })})
          </Button>
          <Button
            onClick={() => {
              onClose()
              onLifetimeCheckout()
            }}
            className="w-full bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black"
          >
            <Crown className="w-4 h-4 mr-2" />
            Get Lifetime Pass —{' '}
            {lifetimeLocalPrice.toLocaleString(undefined, { style: 'currency', currency: checkoutCurrency })}
          </Button>
        </div>

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
