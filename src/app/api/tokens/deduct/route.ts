import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, AuthError, hasUnlimitedAccess } from '@/lib/auth/verifyAuth'

// Valid tool costs - server defined, cannot be manipulated by client
const VALID_TOOL_COSTS: Record<string, number> = {
  tagGenerator: 1,
  thumbnail: 2,
  clipAnalyzer: 2
}

export async function POST(req: NextRequest) {
  try {
    // CRITICAL: Authenticate user from server-side session only
    // NEVER trust req.body.userId - this prevents impersonation attacks
    const user = await verifyAuth(req)
    const userId = user.username

    // Read tool name from body (only field we trust from client)
    const body = await req.json()
    const { tool } = body

    if (!tool || typeof tool !== 'string') {
      return NextResponse.json({ error: 'Tool name required' }, { status: 400 })
    }

    // Validate tool name and get server-defined cost
    // Client cannot manipulate cost - server always defines it
    const cost = VALID_TOOL_COSTS[tool]
    if (typeof cost !== 'number') {
      return NextResponse.json({ 
        error: 'Invalid tool',
        validTools: Object.keys(VALID_TOOL_COSTS)
      }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('sdhq')

    // Check if user has unlimited access (server-verified role)
    if (hasUnlimitedAccess(user)) {
      console.log(`[Tokens] Unlimited access for ${userId}, no deduction for ${tool}`)
      
      // Log the free usage for analytics
      await db.collection('tokenTransactions').insertOne({
        userId: userId.toLowerCase(),
        type: 'spend',
        amount: 0,
        tool,
        balanceAfter: 999999,
        unlimited: true,
        timestamp: new Date().toISOString()
      })
      
      return NextResponse.json({
        success: true,
        remainingTokens: 999999,
        deducted: 0,
        unlimited: true
      })
    }

    // Free user: Get current balance from database
    const tokenBalance = await db.collection('tokenBalances').findOne({ userId: userId.toLowerCase() })

    if (!tokenBalance) {
      return NextResponse.json({ error: 'No token balance found' }, { status: 404 })
    }

    // Check sufficient tokens
    if (tokenBalance.tokens < cost) {
      return NextResponse.json({
        error: 'Insufficient tokens',
        required: cost,
        available: tokenBalance.tokens,
        tool
      }, { status: 403 })
    }

    // Deduct tokens atomically
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
      role: user.role,
      timestamp: new Date().toISOString()
    })

    console.log(`[Tokens] Deducted ${cost} tokens from ${userId} for ${tool}. Remaining: ${result?.value?.tokens}`)

    return NextResponse.json({
      success: true,
      remainingTokens: result?.value?.tokens,
      deducted: cost,
      tool,
      unlimited: false
    })

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    
    console.error('[Tokens] Deduct error:', error)
    return NextResponse.json({ error: 'Failed to deduct tokens' }, { status: 500 })
  }
}
