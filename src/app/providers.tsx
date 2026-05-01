'use client'

import { useCookieConsent } from '@/hooks/useCookieConsent'
import { useAdBlockDetect } from '@/hooks/useAdBlockDetect'
import CookieConsentBanner from './components/CookieConsentBanner'
import AdBlockModal from './components/AdBlockModal'
import Script from 'next/script'
import { useState, useEffect } from 'react'

interface Props {
  children: React.ReactNode
}

export default function Providers({ children }: Props) {
  const { hasConsent, showBanner, acceptCookies, declineCookies } = useCookieConsent()
  const { hasAdBlock, checked } = useAdBlockDetect()
  const [showAdBlockModal, setShowAdBlockModal] = useState(false)
  const [modalShown, setModalShown] = useState(false)

  // Show ad block modal once after detection
  useEffect(() => {
    if (checked && hasAdBlock && !modalShown) {
      setShowAdBlockModal(true)
      setModalShown(true)
    }
  }, [checked, hasAdBlock, modalShown])

  return (
    <>
      {/* Only load Monetag scripts after user consent */}
      {hasConsent === true && (
        <>
          {/* Monetag Vignette Banner Ad - Zone 10951310 */}
          <Script src="https://cdn.monetag.com/v1/pub.js" data-zone="10951310" strategy="afterInteractive" />
          {/* Monetag In-Page Push Ad - Zone 10951309 */}
          <Script src="https://cdn.monetag.com/v1/pub.js" data-zone="10951309" strategy="afterInteractive" />
        </>
      )}

      {children}

      {/* Cookie Consent Banner */}
      {showBanner && (
        <CookieConsentBanner 
          onAccept={acceptCookies} 
          onDecline={declineCookies}
          darkMode={true}
        />
      )}

      {/* Ad Block Modal */}
      {showAdBlockModal && (
        <AdBlockModal 
          onClose={() => setShowAdBlockModal(false)}
          darkMode={true}
        />
      )}
    </>
  )
}
