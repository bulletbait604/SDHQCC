import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, AuthError } from '@/lib/auth/verifyAuth'
import { isAllowlistedOwner } from '@/lib/ownerAllowlist'

export async function POST(req: NextRequest) {
  try {
    const actor = await verifyAuth(req)

    const privileged =
      ['admin', 'owner'].includes(actor.role || 'free') ||
      isAllowlistedOwner(actor.username)

    if (!privileged) {
      return NextResponse.json(
        { error: 'Forbidden: only admins, owners, or allowlisted owners can adjust coins' },
        { status: 403 }
      )
    }

    const { targetUsername, coins } = await req.json()

    if (!targetUsername || typeof coins !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: targetUsername, coins' },
        { status: 400 }
      )
    }

    const normalizedTarget = String(targetUsername).trim().replace(/^@/, '').toLowerCase()
    if (!normalizedTarget) {
      return NextResponse.json({ error: 'Invalid target username' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('sdhq')

    const targetUser = await db.collection('users').findOne({ username: normalizedTarget })
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    /** Same key as /api/coins/balance — lowercase Kick username */
    const balanceUserId = normalizedTarget

    const coinBalance = await db.collection('coinBalances').findOne({ userId: balanceUserId })

    let newBalance: number
    const now = new Date().toISOString()

    if (!coinBalance) {
      newBalance = Math.max(0, coins)
      await db.collection('coinBalances').insertOne({
        userId: balanceUserId,
        coins: newBalance,
        totalPurchased: coins > 0 ? coins : 0,
        totalEarned: coins > 0 ? coins : 0,
        totalSpent: coins < 0 ? Math.abs(coins) : 0,
        lastDailyReset: now,
        createdAt: now,
        updatedAt: now,
      })
    } else {
      newBalance = Math.max(0, (coinBalance.coins || 0) + coins)

      const updateFields: Record<string, number | string> = {
        coins: newBalance,
        updatedAt: now,
      }

      if (coins > 0) {
        updateFields.totalEarned = (coinBalance.totalEarned || 0) + coins
      } else if (coins < 0) {
        updateFields.totalSpent = (coinBalance.totalSpent || 0) + Math.abs(coins)
      }

      await db.collection('coinBalances').updateOne({ userId: balanceUserId }, { $set: updateFields })
    }

    await db.collection('coinTransactions').insertOne({
      userId: balanceUserId,
      type: coins >= 0 ? 'admin_grant' : 'admin_remove',
      amount: coins,
      balanceAfter: newBalance,
      actorUserId: actor.id,
      actorUsername: actor.username,
      timestamp: now,
    })

    await db.collection('activity-logs').insertOne({
      id: Date.now().toString(),
      userId: actor.id,
      username: actor.username,
      timestamp: now,
      action: coins >= 0 ? 'coin_grant' : 'coin_remove',
      details: `${coins >= 0 ? 'Granted' : 'Removed'} ${Math.abs(coins)} coins for ${normalizedTarget}. New balance: ${newBalance}`,
    })

    console.log(
      `[Admin] ${actor.username} ${coins >= 0 ? 'granted' : 'removed'} ${Math.abs(coins)} coins for ${normalizedTarget}. Balance: ${newBalance}`
    )

    return NextResponse.json({
      success: true,
      targetUsername: normalizedTarget,
      coins,
      balance: newBalance,
      action: coins >= 0 ? 'grant' : 'remove',
    })
  } catch (error: unknown) {
    console.error('[Admin Adjust] Error:', error)
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const err = error as { message?: string }
    return NextResponse.json(
      { error: err.message || 'Failed to adjust coins' },
      { status: 500 }
    )
  }
}
