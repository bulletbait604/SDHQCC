import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, hasUnlimitedAccess } from '@/lib/auth/verifyAuth'

const DAILY_FREE_COINS = 10
const DAILY_COOLDOWN_HOURS = 24

export async function POST(req: NextRequest) {
  try {
    // Authenticate user from server-side session
    const user = await verifyAuth(req)
    const userId = user.username

    const client = await clientPromise
    const db = client.db('sdhq')

    // Check if user has unlimited access (they don't need daily coins)
    if (hasUnlimitedAccess(user)) {
      return NextResponse.json({
        success: true,
        coins: 999999,
        unlimited: true,
        message: 'Unlimited access - no daily coins needed'
      })
    }

    // Get user's coin balance
    let coinBalance = await db.collection('coinBalances').findOne({ userId: userId.toLowerCase() })

    // Check if daily coins were already claimed within cooldown period
    if (coinBalance?.lastDailyClaim) {
      const lastClaim = new Date(coinBalance.lastDailyClaim)
      const now = new Date()
      const hoursSinceClaim = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60)

      if (hoursSinceClaim < DAILY_COOLDOWN_HOURS) {
        const hoursRemaining = Math.ceil(DAILY_COOLDOWN_HOURS - hoursSinceClaim)
        return NextResponse.json({
          error: 'Daily coins already claimed',
          hoursRemaining,
          nextClaimTime: new Date(lastClaim.getTime() + DAILY_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString()
        }, { status: 429 })
      }
    }

    // Add daily free coins to balance
    if (!coinBalance) {
      // Create new balance with daily coins
      const now = new Date()
      await db.collection('coinBalances').insertOne({
        userId: userId.toLowerCase(),
        coins: DAILY_FREE_COINS,
        lastDailyClaim: now.toISOString(),
        lastDailyReset: now.toISOString(),
        totalPurchased: 0,
        totalEarned: DAILY_FREE_COINS,
        totalSpent: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      })
    } else {
      // Update existing balance
      await db.collection('coinBalances').updateOne(
        { userId: userId.toLowerCase() },
        {
          $inc: { coins: DAILY_FREE_COINS, totalEarned: DAILY_FREE_COINS },
          $set: { 
            lastDailyClaim: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }
      )
    }

    // Get updated balance
    const updatedBalance = await db.collection('coinBalances').findOne({ userId: userId.toLowerCase() })

    // Log the transaction
    await db.collection('coinTransactions').insertOne({
      userId: userId.toLowerCase(),
      type: 'daily',
      amount: DAILY_FREE_COINS,
      balanceAfter: updatedBalance?.coins,
      timestamp: new Date().toISOString()
    })

    console.log(`[Coins] Daily claim for ${userId}: +${DAILY_FREE_COINS} coins. Balance: ${updatedBalance?.coins}`)

    return NextResponse.json({
      success: true,
      coins: updatedBalance?.coins,
      claimed: DAILY_FREE_COINS,
      nextClaimTime: new Date(Date.now() + DAILY_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString()
    })

  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Coins] Daily claim error:', error)
    return NextResponse.json({ error: 'Failed to claim daily coins' }, { status: 500 })
  }
}
