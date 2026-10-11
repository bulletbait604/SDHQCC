'use client'

import { useEffect, useState } from 'react'
import {
  LIFETIME_PASS,
  PRO_ANNUAL,
  PRO_MONTHLY,
  checkoutQuoteAmountsCad,
} from '@/lib/billing/plans'

export function useCheckoutPricing() {
  const [checkoutCurrency, setCheckoutCurrency] = useState('CAD')
  const [subscriptionLocalPrice, setSubscriptionLocalPrice] = useState(PRO_MONTHLY.priceCad)
  const [annualLocalPrice, setAnnualLocalPrice] = useState(PRO_ANNUAL.priceCad)
  const [lifetimeLocalPrice, setLifetimeLocalPrice] = useState(LIFETIME_PASS.priceCad)
  const [currencyQuoteNote, setCurrencyQuoteNote] = useState('')

  useEffect(() => {
    void fetch(`/api/currency/quote?amountsCad=${checkoutQuoteAmountsCad()}`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load local currency quotes')
        const data = (await r.json()) as {
          currency?: string
          note?: string
          quotes?: Array<{ amountLocal: number }>
        }
        setCheckoutCurrency(data.currency || 'CAD')
        setSubscriptionLocalPrice(data.quotes?.[0]?.amountLocal ?? PRO_MONTHLY.priceCad)
        setAnnualLocalPrice(data.quotes?.[1]?.amountLocal ?? PRO_ANNUAL.priceCad)
        setLifetimeLocalPrice(data.quotes?.[2]?.amountLocal ?? LIFETIME_PASS.priceCad)
        setCurrencyQuoteNote(data.note || '')
      })
      .catch(() => {
        setCheckoutCurrency('CAD')
        setSubscriptionLocalPrice(PRO_MONTHLY.priceCad)
        setAnnualLocalPrice(PRO_ANNUAL.priceCad)
        setLifetimeLocalPrice(LIFETIME_PASS.priceCad)
        setCurrencyQuoteNote('')
      })
  }, [])

  return {
    checkoutCurrency,
    subscriptionLocalPrice,
    annualLocalPrice,
    lifetimeLocalPrice,
    currencyQuoteNote,
  }
}
