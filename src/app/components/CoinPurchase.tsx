'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Coins, X, Loader2 } from 'lucide-react'

interface CoinPackage {
  id: 'small' | 'medium' | 'large'
  coins: number
  price: number
  label: string
}

// Coin packages: $5=12, $10=35, $20=100
const COIN_PACKAGES: CoinPackage[] = [
  { id: 'small', coins: 12, price: 5, label: 'Starter Pack' },      // $5 = 12 coins
  { id: 'medium', coins: 35, price: 10, label: 'Value Pack' },     // $10 = 35 coins
  { id: 'large', coins: 100, price: 20, label: 'Pro Pack' },        // $20 = 100 coins
]

interface CoinPurchaseProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  darkMode?: boolean
}

export default function CoinPurchase({ isOpen, onClose, userId, darkMode = false }: CoinPurchaseProps) {
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handlePurchase = async (pkg: CoinPackage) => {
    setLoading(true)
    setError('')
    
    try {
      // Call the coins purchase API (NOT PayPal directly)
      const response = await fetch('/api/coins/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          packageType: pkg.id,
          coins: pkg.coins,
          price: pkg.price
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create purchase')
      }

      const data = await response.json()
      
      // Redirect to PayPal for payment
      if (data.paypalUrl) {
        window.location.href = data.paypalUrl
      } else if (data.orderId) {
        // Fallback to direct PayPal checkout URL
        window.location.href = `https://www.paypal.com/checkoutnow?token=${data.orderId}`
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate purchase')
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} rounded-xl max-w-md w-full p-6 shadow-2xl`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Coins className={`w-6 h-6 ${darkMode ? 'text-yellow-400' : 'text-yellow-500'}`} />
            <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Buy Coins
            </h3>
          </div>
          <button 
            onClick={onClose}
            className={`p-1 rounded-full hover:bg-gray-200 ${darkMode ? 'hover:bg-sdhq-dark-700 text-white' : 'text-gray-600'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Purchase coins to use our AI-powered tools. Coins never expire!
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {COIN_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg)}
              disabled={loading}
              className={`w-full p-4 rounded-lg border-2 transition-all ${
                selectedPackage?.id === pkg.id
                  ? 'border-sdhq-cyan-500 bg-sdhq-cyan-500/10'
                  : darkMode
                    ? 'border-sdhq-dark-600 hover:border-sdhq-cyan-500/50'
                    : 'border-gray-200 hover:border-sdhq-cyan-300'
              } ${darkMode ? 'bg-sdhq-dark-700' : 'bg-gray-50'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${darkMode ? 'bg-sdhq-dark-600' : 'bg-white'}`}>
                    <Coins className={`w-5 h-5 ${darkMode ? 'text-yellow-400' : 'text-yellow-500'}`} />
                  </div>
                  <div className="text-left">
                    <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {pkg.coins} Coins
                    </p>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {pkg.label}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                    ${pkg.price}
                  </p>
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    CAD
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          <Button
            onClick={() => selectedPackage && handlePurchase(selectedPackage)}
            disabled={!selectedPackage || loading}
            className="w-full bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Coins className="w-4 h-4 mr-2" />
                {selectedPackage 
                  ? `Buy ${selectedPackage.coins} Coins for $${selectedPackage.price}` 
                  : 'Select a Package'}
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className={`w-full ${darkMode ? 'border-sdhq-dark-600 text-white' : ''}`}
          >
            Cancel
          </Button>
        </div>

        <p className={`mt-4 text-xs text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          Payments processed securely via PayPal. Coins are added to your account immediately after payment confirmation.
        </p>
      </div>
    </div>
  )
}
