'use client'

import { useState, useEffect } from 'react'

export type PayPalPublicConfig = {
  sandbox: boolean
  clientId: string | null
  planId: string | null
  /** null if no planId; false if ID doesn’t look like PayPal Billing Plan `P-…` */
  planIdFormatOk?: boolean | null
  /** null = server did not verify (no Client Secret); false = PayPal API could not load this Plan ID */
  planResolvedOnPayPal?: boolean | null
  /** Set when planResolvedOnPayPal === false after server verification attempt */
  planVerifyIssue?: 'oauth' | 'not_found' | 'http' | null
  /** All warnings (e.g. Subscribe popup). */
  warning: string | null
  /** SDK/client issues only — use in coin & donation flows (no subscription plan noise). */
  coinWarning?: string | null
}

/**
 * Loads PayPal mode + client ID + plan ID from the server at runtime so Vercel env
 * changes apply without relying on NEXT_PUBLIC_* values baked into the client bundle.
 */
export function usePayPalPublicConfig(): {
  config: PayPalPublicConfig | null
  loading: boolean
  error: string | null
} {
  const [config, setConfig] = useState<PayPalPublicConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/paypal-public-config', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: PayPalPublicConfig) => {
        if (!cancelled) setConfig(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load PayPal config')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loading = config === null && error === null
  return { config, loading, error }
}
