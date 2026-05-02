import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

const DAILY_FREE_TOKENS = 8
const UNLIMITED_ROLES = ['subscriber', 'subscriber_lifetime', 'admin', 'owner', 'tester']

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
    let tokenBalance = await db.collection('tokenBalances').findOne({ userId: userId.toLowerCase() })

    if (!tokenBalance) {
      // Create new balance with daily tokens
      const now = new Date()
      tokenBalance = {
        userId: userId.toLowerCase(),
        tokens: DAILY_FREE_TOKENS,
        lastDailyReset: now.toISOString(),
        totalPurchased: 0,
        totalEarned: DAILY_FREE_TOKENS,
        totalSpent: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      }
      await db.collection('tokenBalances').insertOne(tokenBalance)
      console.log(`[Tokens] Created new balance for ${userId} with ${DAILY_FREE_TOKENS} daily tokens`)
    } else {
      // Check if we need to reset daily tokens
      const lastReset = tokenBalance.lastDailyReset ? new Date(tokenBalance.lastDailyReset) : null
      const now = new Date()
      const hoursSinceReset = lastReset ? (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60) : 25

      // Reset daily tokens if it's been more than 24 hours
      if (hoursSinceReset >= 24) {
        const newTokens = tokenBalance.tokens + DAILY_FREE_TOKENS
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
        tokenBalance.tokens = newTokens
        tokenBalance.lastDailyReset = now.toISOString()
        console.log(`[Tokens] Daily reset for ${userId}: added ${DAILY_FREE_TOKENS} tokens`)
      }
    }

    return NextResponse.json({
      tokens: tokenBalance.tokens,
      lastDailyReset: tokenBalance.lastDailyReset,
      totalPurchased: tokenBalance.totalPurchased || 0,
      totalEarned: tokenBalance.totalEarned || 0,
      totalSpent: tokenBalance.totalSpent || 0,
      unlimited: false
    })

  } catch (error) {
    console.error('[Tokens] Balance fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch token balance' }, { status: 500 })
  }
}
