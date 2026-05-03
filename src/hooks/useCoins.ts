'use client'

import { useState, useEffect, useCallback } from 'react'

interface UseCoinsOptions {
  userId: string
  userRole?: string
}

// Roles that get unlimited access (no coin deduction)
const UNLIMITED_ROLES = ['subscriber', 'subscriber_lifetime', 'admin', 'owner', 'tester']

// Coin costs per tool
export const COIN_COSTS = {
  'tag-generator': 1,
  'thumbnail-generator': 2,
  'clip-analyzer': 2,
  'content-analyzer': 2,
} as const

export type ToolType = keyof typeof COIN_COSTS

interface CoinBalance {
  coins: number
  lastDailyReset: string | null
  totalPurchased: number
  totalEarned: number
  totalSpent: number
}

export function useCoins({ userId, userRole }: UseCoinsOptions) {
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const hasUnlimitedAccess = userRole ? UNLIMITED_ROLES.includes(userRole) : false

  // Fetch coin balance
  const fetchBalance = useCallback(async () => {
    if (!userId || userId === 'anon') {
      setBalance(0)
      return
    }

    try {
      const response = await fetch('/api/coins/balance', {
        credentials: 'include'
      })

      if (response.status === 401) {
        setBalance(0)
        setError('Session not synced — sign out and sign in with Kick again.')
        return
      }

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        throw new Error((errBody as { error?: string }).error || 'Failed to fetch balance')
      }

      const data = await response.json()
      setBalance(data.coins || 0)
      setError(null)
    } catch (err) {
      console.warn('[Coins] Balance fetch failed:', err)
      setError('Failed to load coin balance')
    }
  }, [userId])

  // Refresh balance whenever the active user changes
  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  // Check if user has enough coins for a tool (use ref to avoid dependency issues)
  const hasEnoughCoins = useCallback((tool: ToolType): boolean => {
    if (hasUnlimitedAccess) return true
    const cost = COIN_COSTS[tool]
    return balance >= cost
  }, [balance, hasUnlimitedAccess])

  // Deduct coins for tool usage
  const deductCoins = useCallback(async (tool: ToolType): Promise<boolean> => {
    if (hasUnlimitedAccess) {
      return true
    }

    setLoading(true)
    try {
      const response = await fetch('/api/coins/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tool })
      })

      if (response.status === 401) {
        setError('Session not synced — sign out and sign in with Kick again.')
        return false
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to deduct coins')
      }

      const data = await response.json()
      setBalance(data.remainingCoins)
      setError(null)
      return true
    } catch (err: any) {
      console.warn('[Coins] Deduction failed:', err)
      setError(err.message || 'Failed to deduct coins')
      return false
    } finally {
      setLoading(false)
    }
  }, [hasUnlimitedAccess])

  // Claim daily free coins (10 coins)
  const claimDailyCoins = useCallback(async (): Promise<boolean> => {
    if (!userId || userId === 'anon') {
      setError('Must be logged in to claim daily coins')
      return false
    }

    setLoading(true)
    try {
      const response = await fetch('/api/coins/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to claim daily coins')
      }

      const data = await response.json()
      setBalance(data.coins)
      setError(null)
      console.log(`[Coins] Claimed daily coins. New balance: ${data.coins}`)
      return true
    } catch (err: any) {
      console.error('[Coins] Daily claim failed:', err)
      setError(err.message || 'Failed to claim daily coins')
      return false
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Purchase coins via PayPal (12, 35, 100 coins)
  const purchaseCoins = useCallback(async (packageType: 'small' | 'medium' | 'large'): Promise<string | null> => {
    if (!userId || userId === 'anon') {
      setError('Must be logged in to purchase coins')
      return null
    }

    const packages = {
      small: { coins: 12, price: 5 },    // $5 = 12 coins
      medium: { coins: 35, price: 10 },  // $10 = 35 coins
      large: { coins: 100, price: 20 }   // $20 = 100 coins
    }

    const pkg = packages[packageType]

    setLoading(true)
    try {
      const response = await fetch('/api/coins/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ packageType, ...pkg })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create purchase')
      }

      const data = await response.json()
      setError(null)
      console.log(`[Coins] Purchase initiated: ${pkg.coins} coins for $${pkg.price}`)
      return data.orderId // Return PayPal order ID
    } catch (err: any) {
      console.error('[Coins] Purchase failed:', err)
      setError(err.message || 'Failed to initiate purchase')
      return null
    } finally {
      setLoading(false)
    }
  }, [userId])

  const refreshBalance = useCallback(() => {
    void fetchBalance()
  }, [fetchBalance])

  return {
    balance,
    loading,
    error,
    hasUnlimitedAccess,
    hasEnoughCoins,
    deductCoins,
    claimDailyCoins,
    purchaseCoins,
    refreshBalance,
    COIN_COSTS
  }
}
