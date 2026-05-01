'use client'

import { X } from 'lucide-react'
import { useState } from 'react'

interface Props {
  onClose: () => void
  darkMode?: boolean
}

export default function AdBlockModal({ onClose, darkMode = true }: Props) {
  const [showSubscribePopup, setShowSubscribePopup] = useState(false)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`relative max-w-md w-full rounded-2xl p-6 shadow-2xl ${
        darkMode 
          ? 'bg-sdhq-dark-800 border border-sdhq-cyan-500/30' 
          : 'bg-white border border-sdhq-cyan-200'
      }`}>
        {/* Close button */}
        <button 
          onClick={onClose}
          className={`absolute top-4 right-4 p-1 rounded-full transition-colors ${
            darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            darkMode ? 'bg-sdhq-cyan-500/20' : 'bg-sdhq-cyan-100'
          }`}>
            <span className="text-3xl">🛡️</span>
          </div>
        </div>

        {/* Title */}
        <h3 className={`text-xl font-bold text-center mb-3 ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}>
          Ad Blocker Detected
        </h3>

        {/* Message */}
        <p className={`text-center mb-6 ${
          darkMode ? 'text-gray-300' : 'text-gray-600'
        }`}>
          We rely on ads to keep this service free for everyone. 
          Please disable your ad blocker for this site, or upgrade to enjoy ad-free access with additional benefits.
        </p>

        {/* Buttons */}
        <div className="space-y-3">
          {/* Monthly Subscribe */}
          <button
            onClick={() => window.open('https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-8UG98407JL9530438N5M7S5Q', '_blank')}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black font-semibold hover:from-sdhq-cyan-600 hover:to-sdhq-green-600 transition-all flex items-center justify-center gap-2"
          >
            <span>⭐</span>
            <span>Subscribe Monthly - $4.99/mo</span>
          </button>

          {/* Lifetime Subscribe */}
          <button
            onClick={() => window.open('https://www.paypal.com/paypalme/bulletbait604/10', '_blank')}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-semibold hover:from-yellow-600 hover:to-orange-600 transition-all flex items-center justify-center gap-2"
          >
            <span>💎</span>
            <span>Lifetime Access - $10 one-time</span>
          </button>

          {/* Continue with ads */}
          <button
            onClick={onClose}
            className={`w-full py-3 px-4 rounded-xl font-medium transition-colors ${
              darkMode 
                ? 'bg-sdhq-dark-700 text-gray-300 hover:bg-sdhq-dark-600' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            I've Disabled My Ad Blocker
          </button>
        </div>

        {/* Footer note */}
        <p className={`text-center text-xs mt-4 ${
          darkMode ? 'text-gray-500' : 'text-gray-400'
        }`}>
          Subscribers get unlimited use, no ads, and priority support.
        </p>
      </div>
    </div>
  )
}
