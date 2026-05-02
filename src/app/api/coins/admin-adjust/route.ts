import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export async function POST(req: NextRequest) {
  try {
    const { actorUsername, targetUsername, coins } = await req.json()

    // Validate input
    if (!actorUsername || !targetUsername || typeof coins !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: actorUsername, targetUsername, coins' },
        { status: 400 }
      )
    }

    // Connect to database
    const client = await clientPromise
    const db = client.db('sdhq')

    // Normalize usernames to lowercase
    const normalizedActor = actorUsername.toLowerCase().trim()
    const normalizedTarget = targetUsername.toLowerCase().trim()

    // Check if actor exists and has admin privileges
    const actor = await db.collection('users').findOne({ username: normalizedActor })
    
    if (!actor) {
      return NextResponse.json({ error: 'Actor user not found' }, { status: 404 })
    }

    // Check if actor has admin role
    const allowedRoles = ['admin', 'owner']
    const actorRole = actor.role || 'free'
    
    if (!allowedRoles.includes(actorRole)) {
      return NextResponse.json(
        { error: 'Unauthorized: Only admins can adjust coin balances' },
        { status: 403 }
      )
    }

    // Check if target user exists
    const targetUser = await db.collection('users').findOne({ username: normalizedTarget })
    
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    // Get or create coin balance for target user
    const coinBalance = await db.collection('coinBalances').findOne({ 
      userId: normalizedTarget 
    })

    let newBalance: number
    const now = new Date().toISOString()

    if (!coinBalance) {
      // Create new balance record
      newBalance = Math.max(0, coins) // Ensure balance doesn't go below 0
      await db.collection('coinBalances').insertOne({
        userId: normalizedTarget,
        coins: newBalance,
        totalPurchased: coins > 0 ? coins : 0,
        totalEarned: coins > 0 ? coins : 0,
        totalSpent: coins < 0 ? Math.abs(coins) : 0,
        createdAt: now,
        updatedAt: now
      })
    } else {
      // Update existing balance
      newBalance = Math.max(0, (coinBalance.coins || 0) + coins)
      
      const updateFields: any = {
        coins: newBalance,
        updatedAt: now
      }

      // Update totals based on operation
      if (coins > 0) {
        updateFields.totalEarned = (coinBalance.totalEarned || 0) + coins
      } else if (coins < 0) {
        updateFields.totalSpent = (coinBalance.totalSpent || 0) + Math.abs(coins)
      }

      await db.collection('coinBalances').updateOne(
        { userId: normalizedTarget },
        { $set: updateFields }
      )
    }

    // Log the adjustment
    await db.collection('coinTransactions').insertOne({
      userId: normalizedTarget,
      type: coins >= 0 ? 'admin_grant' : 'admin_remove',
      amount: coins,
      balanceAfter: newBalance,
      actor: normalizedActor,
      timestamp: now
    })

    // Log to activity logs
    await db.collection('activity-logs').insertOne({
      id: Date.now().toString(),
      username: normalizedActor,
      timestamp: now,
      action: coins >= 0 ? 'coin_grant' : 'coin_remove',
      details: `${coins >= 0 ? 'Granted' : 'Removed'} ${Math.abs(coins)} coins for ${normalizedTarget}. New balance: ${newBalance}`
    })

    console.log(`[Admin] ${normalizedActor} ${coins >= 0 ? 'granted' : 'removed'} ${Math.abs(coins)} coins for ${normalizedTarget}. Balance: ${newBalance}`)

    return NextResponse.json({
      success: true,
      targetUsername: normalizedTarget,
      coins: coins,
      balance: newBalance,
      action: coins >= 0 ? 'grant' : 'remove'
    })

  } catch (error: any) {
    console.error('[Admin Adjust] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to adjust coins' },
      { status: 500 }
    )
  }
}
