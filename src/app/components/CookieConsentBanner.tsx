'use client'

import Link from 'next/link'

interface Props {
  onAccept: () => void
  onDecline: () => void
  darkMode?: boolean
}

export default function CookieConsentBanner({ onAccept, onDecline, darkMode = true }: Props) {
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 p-4 ${darkMode ? 'bg-sdhq-dark-900/95' : 'bg-white/95'} border-t ${darkMode ? 'border-sdhq-cyan-500/30' : 'border-sdhq-cyan-200'} backdrop-blur-sm`}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          <p className="mb-1">
            <span className="font-semibold">We use cookies</span> to deliver personalized ads and improve your experience. 
            By clicking &quot;Accept,&quot; you consent to our use of cookies and the processing of data for advertising purposes. 
            See our <Link href="/privacy" className="text-sdhq-cyan-500 hover:underline">Privacy Policy</Link> for details.
          </p>
          <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Ads help keep this service free for all users. Subscribers can enjoy an ad-free experience.
          </p>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={onDecline}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              darkMode 
                ? 'text-gray-400 hover:text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="px-6 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black hover:from-sdhq-cyan-600 hover:to-sdhq-green-600 transition-all"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
