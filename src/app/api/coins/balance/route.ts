import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, hasUnlimitedAccess } from '@/lib/auth/verifyAuth'
import { WithId, Document } from 'mongodb'

const DAILY_FREE_COINS = 10

interface CoinBalance {
  userId: string
  coins: number
  lastDailyReset?: string
  totalPurchased: number
  totalEarned: number
  totalSpent: number
  createdAt: string
  updatedAt: string
}

export async function GET(req: NextRequest) {
  try {
    // Authenticate user from server-side session
    const user = await verifyAuth(req)
    const userId = user.username

    const client = await clientPromise
    const db = client.db('sdhq')

    // Check if user has unlimited access (subscribers, admins, etc.)
    if (hasUnlimitedAccess(user)) {
      return NextResponse.json({ 
        coins: 999999, 
        unlimited: true,
        role: user.role 
      })
    }

    // Get or create coin balance for free users
    let coinBalance: WithId<Document> | CoinBalance | null = await db.collection('coinBalances').findOne({ userId: userId.toLowerCase() })
    let balance: CoinBalance

    if (!coinBalance) {
      // Create new balance with daily free coins
      const now = new Date()
      balance = {
        userId: userId.toLowerCase(),
        coins: DAILY_FREE_COINS,
        lastDailyReset: now.toISOString(),
        totalPurchased: 0,
        totalEarned: DAILY_FREE_COINS,
        totalSpent: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      }
      await db.collection('coinBalances').insertOne(balance)
      console.log(`[Coins] Created new balance for ${userId} with ${DAILY_FREE_COINS} daily coins`)
    } else {
      // Use the found balance
      balance = coinBalance as unknown as CoinBalance
      
      // Check if we need to reset daily coins (24 hour cooldown)
      const lastReset = balance.lastDailyReset ? new Date(balance.lastDailyReset) : null
      const now = new Date()
      const hoursSinceReset = lastReset ? (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60) : 25

      // Reset daily coins if it's been more than 24 hours
      if (hoursSinceReset >= 24) {
        const newCoins = balance.coins + DAILY_FREE_COINS
        await db.collection('coinBalances').updateOne(
          { userId: userId.toLowerCase() },
          {
            $set: {
              coins: newCoins,
              lastDailyReset: now.toISOString(),
              updatedAt: now.toISOString()
            },
            $inc: { totalEarned: DAILY_FREE_COINS }
          }
        )
        balance.coins = newCoins
        balance.lastDailyReset = now.toISOString()
        console.log(`[Coins] Daily reset for ${userId}: added ${DAILY_FREE_COINS} coins`)
      }
    }

    return NextResponse.json({
      coins: balance.coins,
      lastDailyReset: balance.lastDailyReset,
      totalPurchased: balance.totalPurchased || 0,
      totalEarned: balance.totalEarned || 0,
      totalSpent: balance.totalSpent || 0,
      unlimited: false
    })

  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Coins] Balance fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch coin balance' }, { status: 500 })
  }
}
