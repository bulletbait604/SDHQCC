'use client'

import { useState, useEffect } from 'react'
import { Coins, Crown, Plus } from 'lucide-react'
import TokenPurchase from './TokenPurchase'

interface TokenBalanceProps {
  userId: string
  userRole?: string
  darkMode?: boolean
}

export default function TokenBalance({ userId, userRole, darkMode = false }: TokenBalanceProps) {
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPurchase, setShowPurchase] = useState(false)

  const hasUnlimitedAccess = ['subscriber', 'subscriber_lifetime', 'admin', 'owner', 'tester'].includes(userRole || '')

  useEffect(() => {
    if (!userId || hasUnlimitedAccess) {
      setLoading(false)
      return
    }

    const fetchBalance = async () => {
      try {
        const response = await fetch(`/api/tokens/balance?userId=${userId}`)
        if (response.ok) {
          const data = await response.json()
          setBalance(data.balance)
        }
      } catch (error) {
        console.error('Failed to fetch token balance:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBalance()
    
    // Refresh balance every 30 seconds
    const interval = setInterval(fetchBalance, 30000)
    return () => clearInterval(interval)
  }, [userId, hasUnlimitedAccess])

  if (hasUnlimitedAccess) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500/20 to-cyan-500/20 border border-green-500/30">
        <Crown className="w-4 h-4 text-green-400" />
        <span className="text-sm font-medium text-green-300">Unlimited</span>
      </div>
    )
  }

  if (!userId) return null

  return (
    <>
      <button
        onClick={() => setShowPurchase(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 hover:border-yellow-400/50 transition-all group"
      >
        <Coins className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-medium text-yellow-300">
          {loading ? '...' : `${balance ?? 0} tokens`}
        </span>
        <Plus className="w-3 h-3 text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      <TokenPurchase
        isOpen={showPurchase}
        onClose={() => setShowPurchase(false)}
        userId={userId}
        darkMode={darkMode}
      />
    </>
  )
}
