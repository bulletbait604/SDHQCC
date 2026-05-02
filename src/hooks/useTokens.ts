'use client'

import { useState, useEffect, useCallback } from 'react'

interface UseTokensOptions {
  userId: string
  userRole?: string
}

// Roles that get unlimited access (no token deduction)
const UNLIMITED_ROLES = ['subscriber', 'subscriber_lifetime', 'admin', 'owner', 'tester']

// Token costs per tool
export const TOKEN_COSTS = {
  'tag-generator': 1,
  'thumbnail-generator': 2,
  'clip-analyzer': 2,
  'content-analyzer': 2,
} as const

export type ToolType = keyof typeof TOKEN_COSTS

interface TokenBalance {
  tokens: number
  lastDailyReset: string | null
  totalPurchased: number
  totalEarned: number
  totalSpent: number
}

export function useTokens({ userId, userRole }: UseTokensOptions) {
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const hasUnlimitedAccess = userRole ? UNLIMITED_ROLES.includes(userRole) : false

  // Fetch token balance
  const fetchBalance = useCallback(async () => {
    if (!userId || userId === 'anon') {
      setBalance(0)
      return
    }

    try {
      const response = await fetch('/api/tokens/balance', {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to fetch balance')
      
      const data = await response.json()
      setBalance(data.tokens || 0)
      setError(null)
    } catch (err) {
      console.error('[Tokens] Failed to fetch balance:', err)
      setError('Failed to load token balance')
    }
  }, [userId])

  // Refresh balance whenever the active user changes
  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  // Check if user has enough tokens for a tool
  const hasEnoughTokens = useCallback((tool: ToolType): boolean => {
    if (hasUnlimitedAccess) return true
    const cost = TOKEN_COSTS[tool]
    return balance >= cost
  }, [balance, hasUnlimitedAccess])

  // Deduct tokens for tool usage
  const deductTokens = useCallback(async (tool: ToolType): Promise<boolean> => {
    if (hasUnlimitedAccess) {
      console.log(`[Tokens] Unlimited access - no deduction for ${tool}`)
      return true
    }

    const cost = TOKEN_COSTS[tool]
    
    if (balance < cost) {
      setError(`Insufficient tokens. Need ${cost} tokens, have ${balance}`)
      return false
    }

    setLoading(true)
    try {
      const response = await fetch('/api/tokens/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tool })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to deduct tokens')
      }

      const data = await response.json()
      setBalance(data.remainingTokens)
      setError(null)
      console.log(`[Tokens] Deducted ${cost} tokens for ${tool}. Remaining: ${data.remainingTokens}`)
      return true
    } catch (err: any) {
      console.error('[Tokens] Deduction failed:', err)
      setError(err.message || 'Failed to deduct tokens')
      return false
    } finally {
      setLoading(false)
    }
  }, [userId, balance, hasUnlimitedAccess])

  // Claim daily free tokens (10 tokens)
  const claimDailyTokens = useCallback(async (): Promise<boolean> => {
    if (!userId || userId === 'anon') {
      setError('Must be logged in to claim daily tokens')
      return false
    }

    setLoading(true)
    try {
      const response = await fetch('/api/tokens/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to claim daily tokens')
      }

      const data = await response.json()
      setBalance(data.tokens)
      setError(null)
      console.log(`[Tokens] Claimed daily tokens. New balance: ${data.tokens}`)
      return true
    } catch (err: any) {
      console.error('[Tokens] Daily claim failed:', err)
      setError(err.message || 'Failed to claim daily tokens')
      return false
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Purchase tokens via PayPal
  const purchaseTokens = useCallback(async (packageType: 'small' | 'medium' | 'large'): Promise<string | null> => {
    if (!userId || userId === 'anon') {
      setError('Must be logged in to purchase tokens')
      return null
    }

    const packages = {
      small: { tokens: 20, price: 5 },
      medium: { tokens: 50, price: 10 },
      large: { tokens: 1250, price: 20 }
    }

    const pkg = packages[packageType]

    setLoading(true)
    try {
      const response = await fetch('/api/tokens/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, packageType, ...pkg })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create purchase')
      }

      const data = await response.json()
      setError(null)
      console.log(`[Tokens] Purchase initiated: ${pkg.tokens} tokens for $${pkg.price}`)
      return data.orderId // Return PayPal order ID
    } catch (err: any) {
      console.error('[Tokens] Purchase failed:', err)
      setError(err.message || 'Failed to initiate purchase')
      return null
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Refresh balance manually
  const refreshBalance = useCallback(() => {
    fetchBalance()
  }, [fetchBalance])

  return {
    balance,
    loading,
    error,
    hasUnlimitedAccess,
    hasEnoughTokens,
    deductTokens,
    claimDailyTokens,
    purchaseTokens,
    refreshBalance,
    TOKEN_COSTS
  }
}
