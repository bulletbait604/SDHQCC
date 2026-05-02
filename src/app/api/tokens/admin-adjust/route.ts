import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { adminUsername, targetUsername, tokens } = body

    if (!adminUsername || !targetUsername || typeof tokens !== 'number') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const tokenAmount = Math.floor(tokens)
    if (tokenAmount <= 0) {
      return NextResponse.json({ error: 'Token amount must be greater than 0' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('sdhq')

    const normalizedAdmin = adminUsername.toLowerCase()
    const normalizedTarget = targetUsername.toLowerCase()
    const adminUser = await db.collection('users').findOne({ username: normalizedAdmin })

    if (!adminUser || adminUser.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can grant tokens' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const updateResult = await db.collection('tokenBalances').findOneAndUpdate(
      { userId: normalizedTarget },
      {
        $inc: {
          tokens: tokenAmount,
          totalEarned: tokenAmount
        },
        $set: {
          updatedAt: now
        },
        $setOnInsert: {
          userId: normalizedTarget,
          lastDailyReset: now,
          totalPurchased: 0,
          totalSpent: 0,
          createdAt: now
        }
      },
      { upsert: true, returnDocument: 'after' }
    )

    await db.collection('tokenTransactions').insertOne({
      userId: normalizedTarget,
      type: 'admin_grant',
      amount: tokenAmount,
      grantedBy: normalizedAdmin,
      balanceAfter: updateResult?.value?.tokens ?? tokenAmount,
      timestamp: now
    })

    await db.collection('activity-logs').insertOne({
      id: Date.now().toString(),
      username: normalizedAdmin,
      timestamp: now,
      action: 'token_grant',
      details: `Granted ${tokenAmount} tokens to ${normalizedTarget}`
    })

    return NextResponse.json({
      success: true,
      targetUsername: normalizedTarget,
      granted: tokenAmount,
      balance: updateResult?.value?.tokens ?? tokenAmount
    })
  } catch (error) {
    console.error('[Tokens] Admin adjust error:', error)
    return NextResponse.json({ error: 'Failed to grant tokens' }, { status: 500 })
  }
}
