'use client'

import { useCookieConsent } from '@/hooks/useCookieConsent'
import CookieConsentBanner from './components/CookieConsentBanner'
import Script from 'next/script'

interface Props {
  children: React.ReactNode
}

export default function Providers({ children }: Props) {
  const { hasConsent, showBanner, acceptCookies, declineCookies } = useCookieConsent()

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
    </>
  )
}
