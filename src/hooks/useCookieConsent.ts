'use client'

import { useState, useEffect, useCallback } from 'react'
import { getClientCookie, setClientCookie, deleteClientCookie } from '@/lib/clientCookies'

const CONSENT_COOKIE = 'sdhq_cookie_consent'

interface CookieConsent {
  accepted: boolean
  timestamp: string
}

function parseConsent(raw: string | null): CookieConsent | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as CookieConsent
  } catch {
    return null
  }
}

export function useCookieConsent() {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const stored = parseConsent(getClientCookie(CONSENT_COOKIE))
    if (stored) {
      setHasConsent(stored.accepted)
      setShowBanner(false)
    } else {
      setHasConsent(false)
      setShowBanner(true)
    }
  }, [])

  const acceptCookies = useCallback(() => {
    const consent: CookieConsent = {
      accepted: true,
      timestamp: new Date().toISOString(),
    }
    setClientCookie(CONSENT_COOKIE, JSON.stringify(consent))
    setHasConsent(true)
    setShowBanner(false)
  }, [])

  const declineCookies = useCallback(() => {
    const consent: CookieConsent = {
      accepted: false,
      timestamp: new Date().toISOString(),
    }
    setClientCookie(CONSENT_COOKIE, JSON.stringify(consent))
    setHasConsent(false)
    setShowBanner(false)
  }, [])

  const resetConsent = useCallback(() => {
    deleteClientCookie(CONSENT_COOKIE)
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
