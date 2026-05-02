import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

const UNLIMITED_ROLES = ['subscriber', 'subscriber_lifetime', 'admin', 'owner', 'tester']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, tool, cost } = body

    if (!userId || !tool || typeof cost !== 'number') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('sdhq')

    // Check if user has unlimited access
    const user = await db.collection('users').findOne({ username: userId.toLowerCase() })
    if (user?.role && UNLIMITED_ROLES.includes(user.role)) {
      console.log(`[Tokens] Unlimited access for ${userId}, no deduction for ${tool}`)
      return NextResponse.json({
        success: true,
        remainingTokens: 999999,
        deducted: 0,
        unlimited: true
      })
    }

    // Get current balance
    const tokenBalance = await db.collection('tokenBalances').findOne({ userId: userId.toLowerCase() })

    if (!tokenBalance) {
      return NextResponse.json({ error: 'No token balance found' }, { status: 404 })
    }

    if (tokenBalance.tokens < cost) {
      return NextResponse.json({
        error: 'Insufficient tokens',
        required: cost,
        available: tokenBalance.tokens
      }, { status: 403 })
    }

    // Deduct tokens
    const result = await db.collection('tokenBalances').findOneAndUpdate(
      { userId: userId.toLowerCase() },
      {
        $inc: {
          tokens: -cost,
          totalSpent: cost
        },
        $set: {
          updatedAt: new Date().toISOString()
        }
      },
      { returnDocument: 'after' }
    )

    // Log the transaction
    await db.collection('tokenTransactions').insertOne({
      userId: userId.toLowerCase(),
      type: 'spend',
      amount: -cost,
      tool,
      balanceAfter: result?.value?.tokens,
      timestamp: new Date().toISOString()
    })

    console.log(`[Tokens] Deducted ${cost} tokens from ${userId} for ${tool}. Remaining: ${result?.value?.tokens}`)

    return NextResponse.json({
      success: true,
      remainingTokens: result?.value?.tokens,
      deducted: cost
    })

  } catch (error) {
    console.error('[Tokens] Deduct error:', error)
    return NextResponse.json({ error: 'Failed to deduct tokens' }, { status: 500 })
  }
}
