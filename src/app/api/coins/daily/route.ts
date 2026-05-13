import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, hasUnlimitedAccess, AuthError } from '@/lib/auth/verifyAuth'
import { resolveCoinBalanceUserId } from '@/lib/coinUserId'
import {
  DAILY_FREE_COINS,
  coinsAfterDailyRefresh,
} from '@/lib/coinPurchasedBalance'

const DAILY_COOLDOWN_HOURS = 24

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)

    const client = await clientPromise
    const db = client.db('sdhq')

    const balanceUserId = await resolveCoinBalanceUserId(db, user)

    if (hasUnlimitedAccess(user)) {
      return NextResponse.json({
        success: true,
        coins: 999999,
        unlimited: true,
        message: 'Unlimited access - no daily coins needed',
      })
    }

    const coinBalance = await db.collection('coinBalances').findOne({ userId: balanceUserId })
    const now = new Date()

    if (coinBalance?.lastDailyReset) {
      const lastReset = new Date(coinBalance.lastDailyReset)
      const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60)

      if (hoursSinceReset < DAILY_COOLDOWN_HOURS) {
        const coins = typeof coinBalance.coins === 'number' ? coinBalance.coins : 0
        return NextResponse.json({
          success: true,
          coins,
          claimed: 0,
          alreadyRefreshed: true,
          nextClaimTime: new Date(
            lastReset.getTime() + DAILY_COOLDOWN_HOURS * 60 * 60 * 1000
          ).toISOString(),
        })
      }
    }

    if (!coinBalance) {
      await db.collection('coinBalances').insertOne({
        userId: balanceUserId,
        coins: DAILY_FREE_COINS,
        purchasedBalance: 0,
        lastDailyClaim: now.toISOString(),
        lastDailyReset: now.toISOString(),
        totalPurchased: 0,
        totalEarned: DAILY_FREE_COINS,
        totalSpent: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
    } else {
      const { newCoins, purchasedBalance } = coinsAfterDailyRefresh(coinBalance)
      await db.collection('coinBalances').updateOne(
        { userId: balanceUserId },
        {
          $set: {
            coins: newCoins,
            purchasedBalance,
            lastDailyClaim: now.toISOString(),
            lastDailyReset: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        }
      )
    }

    const updatedBalance = await db.collection('coinBalances').findOne({ userId: balanceUserId })

    await db.collection('coinTransactions').insertOne({
      userId: balanceUserId,
      username: user.username,
      type: 'daily',
      amount: DAILY_FREE_COINS,
      balanceAfter: updatedBalance?.coins,
      timestamp: now.toISOString(),
    })

    console.log(
      `[Coins] Daily refresh (claim) for ${user.username} (${balanceUserId}). Balance: ${updatedBalance?.coins}`
    )

    return NextResponse.json({
      success: true,
      coins: updatedBalance?.coins,
      claimed: DAILY_FREE_COINS,
      nextClaimTime: new Date(now.getTime() + DAILY_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString(),
    })
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[Coins] Daily claim error:', error)
    return NextResponse.json({ error: 'Failed to claim daily coins' }, { status: 500 })
  }
}
