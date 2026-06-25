'use client'

import { useEffect, useState } from 'react'

export function useCheckoutPricing() {
  const [checkoutCurrency, setCheckoutCurrency] = useState('CAD')
  const [subscriptionLocalPrice, setSubscriptionLocalPrice] = useState(9.5)
  const [lifetimeLocalPrice, setLifetimeLocalPrice] = useState(89.99)
  const [currencyQuoteNote, setCurrencyQuoteNote] = useState('')

  useEffect(() => {
    void fetch('/api/currency/quote?amountsCad=9.5,89.99', { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load local currency quotes')
        const data = (await r.json()) as {
          currency?: string
          note?: string
          quotes?: Array<{ amountLocal: number }>
        }
        setCheckoutCurrency(data.currency || 'CAD')
        setSubscriptionLocalPrice(data.quotes?.[0]?.amountLocal ?? 9.5)
        setLifetimeLocalPrice(data.quotes?.[1]?.amountLocal ?? 89.99)
        setCurrencyQuoteNote(data.note || '')
      })
      .catch(() => {
        setCheckoutCurrency('CAD')
        setSubscriptionLocalPrice(9.5)
        setLifetimeLocalPrice(89.99)
        setCurrencyQuoteNote('')
      })
  }, [])

  return {
    checkoutCurrency,
    subscriptionLocalPrice,
    lifetimeLocalPrice,
    currencyQuoteNote,
  }
}
