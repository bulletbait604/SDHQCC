'use client'

import { useState } from 'react'
import { X, Heart } from 'lucide-react'

interface Props {
  onClose: () => void
  darkMode?: boolean
  defaultAmount?: number
}

export default function DonateModal({ onClose, darkMode = true, defaultAmount = 5 }: Props) {
  const [amount, setAmount] = useState(defaultAmount.toString())

  const handleDonate = () => {
    const donateUrl = `https://www.paypal.com/paypalme/bulletbait604/${amount}`
    window.open(donateUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes')
  }

  const presetAmounts = [5, 10, 25, 50, 100]

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
            darkMode ? 'bg-pink-500/20' : 'bg-pink-100'
          }`}>
            <Heart className={`w-8 h-8 ${darkMode ? 'text-pink-400' : 'text-pink-500'}`} />
          </div>
        </div>

        {/* Title */}
        <h3 className={`text-xl font-bold text-center mb-2 ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}>
          Support Stream Dreams Creator Corner
        </h3>

        {/* Message */}
        <p className={`text-center mb-6 ${
          darkMode ? 'text-gray-300' : 'text-gray-600'
        }`}>
          Your donation helps keep these tools free for creators worldwide. Every contribution makes a difference!
        </p>

        {/* Preset Amounts */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {presetAmounts.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset.toString())}
              className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                amount === preset.toString()
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                  : darkMode
                    ? 'bg-sdhq-dark-700 text-gray-300 hover:bg-sdhq-dark-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ${preset}
            </button>
          ))}
        </div>

        {/* Custom Amount */}
        <div className={`flex items-center gap-2 p-3 rounded-lg border mb-6 ${
          darkMode ? 'bg-sdhq-dark-700 border-sdhq-dark-600' : 'bg-white border-gray-200'
        }`}>
          <span className={`text-lg font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            className={`flex-1 bg-transparent text-lg font-semibold outline-none ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}
            placeholder="Enter amount"
          />
        </div>

        {/* Donate Button */}
        <button
          onClick={handleDonate}
          disabled={!amount || parseFloat(amount) <= 0}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-lg hover:from-pink-600 hover:to-rose-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .757-.629h6.713c2.838 0 5.098.835 5.838 2.44.61 1.336.397 2.838-.61 4.384-.983 1.51-2.587 2.537-4.655 2.943l-.034.006h.034c2.948.622 5.098 2.024 6.03 4.66.468 1.28.468 2.54.02 3.686-.92 2.4-3.194 3.725-6.665 3.868l-.034.004H7.076z"/>
          </svg>
          Donate ${amount}
        </button>

        {/* Footer */}
        <p className={`text-center text-xs mt-4 ${
          darkMode ? 'text-gray-500' : 'text-gray-400'
        }`}>
          Powered by PayPal • Secure payment processing
        </p>
      </div>
    </div>
  )
}
