import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, AuthError, createAuthErrorResponse, hasUnlimitedAccess } from '@/lib/auth/verifyAuth'
import { resolveCoinBalanceUserId } from '@/lib/coinUserId'
import { POST as coinsDailyPost } from '@/app/api/coins/daily/route'
import { attachTokenDeprecation, mapCoinsBodyToTokens } from '@/lib/coins/tokenLegacyProxy'

/** @deprecated Use POST /api/coins/daily */
export async function POST(req: NextRequest) {
  const res = await coinsDailyPost(req)
  const body = (await res.json()) as Record<string, unknown>
  const mapped = mapCoinsBodyToTokens(body)
  if (typeof mapped.coins === 'number' && mapped.tokens === undefined) {
    mapped.tokens = mapped.coins
  }
  return attachTokenDeprecation(NextResponse.json(mapped, { status: res.status }))
}

/** @deprecated Legacy daily status check — maps coin balance fields to token names. */
export async function GET(req: NextRequest) {
  try {
    const sessionUser = await verifyAuth(req)
    const client = await clientPromise
    const db = client.db('sdhq')

    if (hasUnlimitedAccess(sessionUser)) {
      return attachTokenDeprecation(
        NextResponse.json({
          canClaim: false,
          reason: 'unlimited_access',
          unlimited: true,
        })
      )
    }

    const balanceUserId = await resolveCoinBalanceUserId(db, sessionUser)
    const coinBalance = await db.collection('coinBalances').findOne({ userId: balanceUserId })

    if (!coinBalance || !coinBalance.lastDailyReset) {
      return attachTokenDeprecation(
        NextResponse.json({
          canClaim: true,
          hoursRemaining: 0,
          tokens: coinBalance?.coins || 0,
        })
      )
    }

    const lastReset = new Date(coinBalance.lastDailyReset)
    const now = new Date()
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60)

    if (hoursSinceReset >= 24) {
      return attachTokenDeprecation(
        NextResponse.json({
          canClaim: true,
          hoursRemaining: 0,
          tokens: coinBalance.coins,
        })
      )
    }

    const hoursRemaining = Math.ceil(24 - hoursSinceReset)
    const nextClaim = new Date(lastReset.getTime() + 24 * 60 * 60 * 1000)

    return attachTokenDeprecation(
      NextResponse.json({
        canClaim: false,
        hoursRemaining,
        nextClaim: nextClaim.toISOString(),
        tokens: coinBalance.coins,
        reason: 'already_claimed',
      })
    )
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[Tokens] Daily check error:', error)
    return NextResponse.json({ error: 'Failed to check daily status' }, { status: 500 })
  }
}
