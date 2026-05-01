'use client'

import { useState, useEffect, useCallback } from 'react'

const CONSENT_KEY = 'sdhq-cookie-consent'

interface CookieConsent {
  accepted: boolean
  timestamp: string
}

export function useCookieConsent() {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Check for existing consent
    const stored = localStorage.getItem(CONSENT_KEY)
    if (stored) {
      const consent: CookieConsent = JSON.parse(stored)
      setHasConsent(consent.accepted)
      setShowBanner(false)
    } else {
      // First visit - show banner
      setHasConsent(false)
      setShowBanner(true)
    }
  }, [])

  const acceptCookies = useCallback(() => {
    const consent: CookieConsent = {
      accepted: true,
      timestamp: new Date().toISOString(),
    }
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
    setHasConsent(true)
    setShowBanner(false)
  }, [])

  const declineCookies = useCallback(() => {
    const consent: CookieConsent = {
      accepted: false,
      timestamp: new Date().toISOString(),
    }
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
    setHasConsent(false)
    setShowBanner(false)
  }, [])

  const resetConsent = useCallback(() => {
    localStorage.removeItem(CONSENT_KEY)
    setHasConsent(null)
    setShowBanner(true)
  }, [])

  return {
    hasConsent,
    showBanner,
    acceptCookies,
    declineCookies,
    resetConsent,
  }
}
