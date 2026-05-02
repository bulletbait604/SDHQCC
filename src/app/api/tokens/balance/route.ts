import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { WithId, Document } from 'mongodb'

const DAILY_FREE_TOKENS = 8
const UNLIMITED_ROLES = ['subscriber', 'subscriber_lifetime', 'admin', 'owner', 'tester']

interface TokenBalance {
  userId: string
  tokens: number
  lastDailyReset?: string
  totalPurchased: number
  totalEarned: number
  totalSpent: number
  createdAt: string
  updatedAt: string
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId || userId === 'anon') {
      return NextResponse.json({ tokens: 0, isGuest: true })
    }

    const client = await clientPromise
    const db = client.db('sdhq')

    // Get user to check role
    const user = await db.collection('users').findOne({ username: userId.toLowerCase() })
    
    // Unlimited access users don't need tokens
    if (user?.role && UNLIMITED_ROLES.includes(user.role)) {
      return NextResponse.json({ 
        tokens: 999999, 
        unlimited: true,
        role: user.role 
      })
    }

    // Get or create token balance
    let tokenBalance: WithId<Document> | TokenBalance | null = await db.collection('tokenBalances').findOne({ userId: userId.toLowerCase() })
    let balance: TokenBalance

    if (!tokenBalance) {
      // Create new balance with daily tokens
      const now = new Date()
      balance = {
        userId: userId.toLowerCase(),
        tokens: DAILY_FREE_TOKENS,
        lastDailyReset: now.toISOString(),
        totalPurchased: 0,
        totalEarned: DAILY_FREE_TOKENS,
        totalSpent: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      }
      await db.collection('tokenBalances').insertOne(balance)
      console.log(`[Tokens] Created new balance for ${userId} with ${DAILY_FREE_TOKENS} daily tokens`)
    } else {
      // Use the found balance and cast to our type
      balance = tokenBalance as unknown as TokenBalance
      
      // Check if we need to reset daily tokens
      const lastReset = balance.lastDailyReset ? new Date(balance.lastDailyReset) : null
      const now = new Date()
      const hoursSinceReset = lastReset ? (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60) : 25

      // Reset daily tokens if it's been more than 24 hours
      if (hoursSinceReset >= 24) {
        const newTokens = balance.tokens + DAILY_FREE_TOKENS
        await db.collection('tokenBalances').updateOne(
          { userId: userId.toLowerCase() },
          {
            $set: {
              tokens: newTokens,
              lastDailyReset: now.toISOString(),
              updatedAt: now.toISOString()
            },
            $inc: { totalEarned: DAILY_FREE_TOKENS }
          }
        )
        balance.tokens = newTokens
        balance.lastDailyReset = now.toISOString()
        console.log(`[Tokens] Daily reset for ${userId}: added ${DAILY_FREE_TOKENS} tokens`)
      }
    }

    return NextResponse.json({
      tokens: balance.tokens,
      lastDailyReset: balance.lastDailyReset,
      totalPurchased: balance.totalPurchased || 0,
      totalEarned: balance.totalEarned || 0,
      totalSpent: balance.totalSpent || 0,
      unlimited: false
    })

  } catch (error) {
    console.error('[Tokens] Balance fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch token balance' }, { status: 500 })
  }
}
