import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, hasUnlimitedAccess, AuthError } from '@/lib/auth/verifyAuth'
import { resolveCoinBalanceUserId } from '@/lib/coinUserId'
import { splitCoinSpend } from '@/lib/coinPurchasedBalance'

// Valid tool costs - server defined, cannot be manipulated by client
const VALID_TOOL_COSTS: Record<string, number> = {
  'tag-generator': 1,        // 1 coin for free users
  'thumbnail-generator': 2,  // 2 coins for free users
  'clip-analyzer': 2,        // 2 coins for free users
  'background-remover': 0,   // free for all users
  'content-analyzer': 2,     // 2 coins for free users
  'clip-editor-plan': 2,
  'clip-editor-runway': 3,
  'clip-editor-cut': 1,
  'clip-editor-finish': 1,
  'clip-editor-effects': 1,
  'clip-editor-text': 1,
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate user from server-side session
    const user = await verifyAuth(req)

    // Read tool name from body (only field we trust from client)
    const body = await req.json()
    const { tool } = body

    if (!tool || typeof tool !== 'string') {
      return NextResponse.json({ error: 'Tool name required' }, { status: 400 })
    }

    // Validate tool name and get server-defined cost
    const cost = VALID_TOOL_COSTS[tool]
    if (typeof cost !== 'number') {
      return NextResponse.json({ 
        error: 'Invalid tool',
        validTools: Object.keys(VALID_TOOL_COSTS)
      }, { status: 400 })
    }

    const client = await clientPromise

    if (cost === 0) {
      const dbZero = client.db('sdhq')
      const balanceUserIdZero = await resolveCoinBalanceUserId(dbZero, user)
      if (hasUnlimitedAccess(user)) {
        await dbZero.collection('coinTransactions').insertOne({
          userId: user.username.toLowerCase(),
          username: user.username,
          type: 'spend',
          amount: 0,
          tool,
          balanceAfter: 999999,
          unlimited: true,
          role: user.role,
          timestamp: new Date().toISOString()
        })
        return NextResponse.json({
          success: true,
          remainingCoins: 999999,
          deducted: 0,
          unlimited: true
        })
      }
      const coinBalanceZero = await dbZero.collection('coinBalances').findOne({ userId: balanceUserIdZero })
      const remainingZero = typeof coinBalanceZero?.coins === 'number' ? coinBalanceZero.coins : 0
      await dbZero.collection('coinTransactions').insertOne({
        userId: balanceUserIdZero,
        username: user.username,
        type: 'spend',
        amount: 0,
        tool,
        balanceAfter: remainingZero,
        role: user.role,
        timestamp: new Date().toISOString()
      })
      return NextResponse.json({
        success: true,
        remainingCoins: remainingZero,
        deducted: 0,
        unlimited: false
      })
    }

    const db = client.db('sdhq')

    const balanceUserId = await resolveCoinBalanceUserId(db, user)

    // Check if user has unlimited access (subscribers get free usage)
    if (hasUnlimitedAccess(user)) {
      console.log(`[Coins] Unlimited access for ${user.username}, no deduction for ${tool}`)
      
      // Log the free usage for analytics
      await db.collection('coinTransactions').insertOne({
        userId: user.username.toLowerCase(),
        username: user.username,
        type: 'spend',
        amount: 0,
        tool,
        balanceAfter: 999999,
        unlimited: true,
        role: user.role,
        timestamp: new Date().toISOString()
      })
      
      console.log(`[Coins] Unlimited access user ${user.username} used ${tool}`)

      return NextResponse.json({
        success: true,
        remainingCoins: 999999,
        deducted: 0,
        unlimited: true
      })
    }

    // Free user: Get current coin balance from database
    const coinBalance = await db.collection('coinBalances').findOne({ userId: balanceUserId })

    if (!coinBalance) {
      return NextResponse.json({ error: 'No coin balance found' }, { status: 404 })
    }

    // Check sufficient coins
    if (coinBalance.coins < cost) {
      return NextResponse.json({
        error: 'Insufficient coins',
        required: cost,
        available: coinBalance.coins,
        tool
      }, { status: 403 })
    }

    const { newCoins, purchasedBalance } = splitCoinSpend(coinBalance, cost)

    const result = await db.collection('coinBalances').findOneAndUpdate(
      { userId: balanceUserId, coins: coinBalance.coins },
      {
        $set: {
          coins: newCoins,
          purchasedBalance,
          updatedAt: new Date().toISOString(),
        },
        $inc: { totalSpent: cost },
      },
      { returnDocument: 'after' }
    )

    if (!result?.value) {
      return NextResponse.json(
        { error: 'Balance changed — please retry', required: cost, tool },
        { status: 409 }
      )
    }

    // Log the transaction
    await db.collection('coinTransactions').insertOne({
      userId: balanceUserId,
      username: user.username,
      type: 'spend',
      amount: -cost,
      tool,
      balanceAfter: result?.value?.coins,
      role: user.role,
      timestamp: new Date().toISOString()
    })

    console.log(`[Coins] Deducted ${cost} coins from ${user.username} (${balanceUserId}) for ${tool}. Remaining: ${result?.value?.coins}`)

    return NextResponse.json({
      success: true,
      remainingCoins: result?.value?.coins,
      deducted: cost,
      tool,
      unlimited: false
    })

  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[Coins] Deduct error:', error)
    return NextResponse.json({ error: 'Failed to deduct coins' }, { status: 500 })
  }
}
