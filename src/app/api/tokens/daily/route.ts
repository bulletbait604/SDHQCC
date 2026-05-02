import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

const DAILY_FREE_TOKENS = 10
const UNLIMITED_ROLES = ['subscriber', 'subscriber_lifetime', 'admin', 'owner', 'tester']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId } = body

    if (!userId || userId === 'anon') {
      return NextResponse.json({ error: 'Must be logged in' }, { status: 401 })
    }

    const client = await clientPromise
    const db = client.db('sdhq')

    // Check if user has unlimited access (they don't need daily tokens)
    const user = await db.collection('users').findOne({ username: userId.toLowerCase() })
    if (user?.role && UNLIMITED_ROLES.includes(user.role)) {
      return NextResponse.json({
        tokens: 999999,
        unlimited: true,
        message: 'Unlimited access - no daily tokens needed'
      })
    }

    // Get current balance
    const tokenBalance = await db.collection('tokenBalances').findOne({ userId: userId.toLowerCase() })

    const now = new Date()

    if (!tokenBalance) {
      // Create new user with daily tokens
      const newBalance = {
        userId: userId.toLowerCase(),
        tokens: DAILY_FREE_TOKENS,
        lastDailyReset: now.toISOString(),
        totalPurchased: 0,
        totalEarned: DAILY_FREE_TOKENS,
        totalSpent: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      }
      await db.collection('tokenBalances').insertOne(newBalance)
      
      console.log(`[Tokens] Initial daily tokens claimed for ${userId}: ${DAILY_FREE_TOKENS}`)
      
      return NextResponse.json({
        tokens: DAILY_FREE_TOKENS,
        claimed: DAILY_FREE_TOKENS,
        isNewUser: true
      })
    }

    // Check when they last claimed daily tokens
    const lastReset = tokenBalance.lastDailyReset ? new Date(tokenBalance.lastDailyReset) : null
    const hoursSinceReset = lastReset ? (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60) : 25

    if (hoursSinceReset < 24) {
      const hoursRemaining = Math.ceil(24 - hoursSinceReset)
      return NextResponse.json({
        error: 'Daily tokens already claimed',
        hoursRemaining,
        nextClaim: new Date(lastReset!.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        tokens: tokenBalance.tokens
      }, { status: 429 })
    }

    // Grant daily tokens
    const newBalance = tokenBalance.tokens + DAILY_FREE_TOKENS
    
    await db.collection('tokenBalances').updateOne(
      { userId: userId.toLowerCase() },
      {
        $set: {
          tokens: newBalance,
          lastDailyReset: now.toISOString(),
          updatedAt: now.toISOString()
        },
        $inc: { totalEarned: DAILY_FREE_TOKENS }
      }
    )

    // Log the transaction
    await db.collection('tokenTransactions').insertOne({
      userId: userId.toLowerCase(),
      type: 'daily',
      amount: DAILY_FREE_TOKENS,
      balanceAfter: newBalance,
      timestamp: now.toISOString()
    })

    console.log(`[Tokens] Daily tokens claimed for ${userId}: +${DAILY_FREE_TOKENS}, new balance: ${newBalance}`)

    return NextResponse.json({
      tokens: newBalance,
      claimed: DAILY_FREE_TOKENS,
      hoursRemaining: 24
    })

  } catch (error) {
    console.error('[Tokens] Daily claim error:', error)
    return NextResponse.json({ error: 'Failed to claim daily tokens' }, { status: 500 })
  }
}

// GET endpoint to check if daily tokens are available
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId || userId === 'anon') {
      return NextResponse.json({ canClaim: false, reason: 'not_logged_in' })
    }

    const client = await clientPromise
    const db = client.db('sdhq')

    // Check if user has unlimited access
    const user = await db.collection('users').findOne({ username: userId.toLowerCase() })
    if (user?.role && UNLIMITED_ROLES.includes(user.role)) {
      return NextResponse.json({
        canClaim: false,
        reason: 'unlimited_access',
        unlimited: true
      })
    }

    const tokenBalance = await db.collection('tokenBalances').findOne({ userId: userId.toLowerCase() })

    if (!tokenBalance || !tokenBalance.lastDailyReset) {
      return NextResponse.json({
        canClaim: true,
        hoursRemaining: 0,
        tokens: tokenBalance?.tokens || 0
      })
    }

    const lastReset = new Date(tokenBalance.lastDailyReset)
    const now = new Date()
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60)

    if (hoursSinceReset >= 24) {
      return NextResponse.json({
        canClaim: true,
        hoursRemaining: 0,
        tokens: tokenBalance.tokens
      })
    }

    const hoursRemaining = Math.ceil(24 - hoursSinceReset)
    const nextClaim = new Date(lastReset.getTime() + 24 * 60 * 60 * 1000)

    return NextResponse.json({
      canClaim: false,
      hoursRemaining,
      nextClaim: nextClaim.toISOString(),
      tokens: tokenBalance.tokens,
      reason: 'already_claimed'
    })

  } catch (error) {
    console.error('[Tokens] Daily check error:', error)
    return NextResponse.json({ error: 'Failed to check daily status' }, { status: 500 })
  }
}
