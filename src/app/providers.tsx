'use client'

import { useCookieConsent } from '@/hooks/useCookieConsent'
import CookieConsentBanner from './components/CookieConsentBanner'

interface Props {
  children: React.ReactNode
}

export default function Providers({ children }: Props) {
  const { hasConsent, showBanner, acceptCookies, declineCookies } = useCookieConsent()

  return (
    <>
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
