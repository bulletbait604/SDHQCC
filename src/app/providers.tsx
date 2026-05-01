'use client'

import { useCookieConsent } from '@/hooks/useCookieConsent'
import { useAdBlockDetect } from '@/hooks/useAdBlockDetect'
import CookieConsentBanner from './components/CookieConsentBanner'
import AdBlockModal from './components/AdBlockModal'
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
