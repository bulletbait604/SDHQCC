import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, hasUnlimitedAccess } from '@/lib/auth/verifyAuth'

// Valid tool costs - server defined, cannot be manipulated by client
const VALID_TOOL_COSTS: Record<string, number> = {
  'tag-generator': 1,        // 1 coin for free users
  'thumbnail-generator': 2,  // 2 coins for free users
  'clip-analyzer': 2,        // 2 coins for free users
  'content-analyzer': 2      // 2 coins for free users
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate user from server-side session
    const user = await verifyAuth(req)
    const userId = user.username

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
    const db = client.db('sdhq')

    // Check if user has unlimited access (subscribers get free usage)
    if (hasUnlimitedAccess(user)) {
      console.log(`[Coins] Unlimited access for ${userId}, no deduction for ${tool}`)
      
      // Log the free usage for analytics
      await db.collection('coinTransactions').insertOne({
        userId: userId.toLowerCase(),
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

    // Free user: Get current coin balance from database
    const coinBalance = await db.collection('coinBalances').findOne({ userId: userId.toLowerCase() })

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

    // Deduct coins atomically
    const result = await db.collection('coinBalances').findOneAndUpdate(
      { userId: userId.toLowerCase() },
      {
        $inc: {
          coins: -cost,
          totalSpent: cost
        },
        $set: {
          updatedAt: new Date().toISOString()
        }
      },
      { returnDocument: 'after' }
    )

    // Log the transaction
    await db.collection('coinTransactions').insertOne({
      userId: userId.toLowerCase(),
      type: 'spend',
      amount: -cost,
      tool,
      balanceAfter: result?.value?.coins,
      role: user.role,
      timestamp: new Date().toISOString()
    })

    console.log(`[Coins] Deducted ${cost} coins from ${userId} for ${tool}. Remaining: ${result?.value?.coins}`)

    return NextResponse.json({
      success: true,
      remainingCoins: result?.value?.coins,
      deducted: cost,
      tool,
      unlimited: false
    })

  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Coins] Deduct error:', error)
    return NextResponse.json({ error: 'Failed to deduct coins' }, { status: 500 })
  }
}
