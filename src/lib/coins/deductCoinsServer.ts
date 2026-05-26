import clientPromise from '@/lib/mongodb'
import type { VerifiedUser } from '@/lib/auth/verifyAuth'
import { hasUnlimitedAccess } from '@/lib/auth/verifyAuth'
import { resolveCoinBalanceUserId } from '@/lib/coinUserId'
import { splitCoinSpend } from '@/lib/coinPurchasedBalance'

export const CLIP_EDITOR_PHASE_COIN_COSTS = {
  'clip-editor-cut': 1,
  'clip-editor-finish': 1,
  'clip-editor-effects': 1,
  'clip-editor-text': 1,
  'clip-editor-plan': 2,
  'clip-editor-runway': 3,
} as const

export type ClipEditorPhaseCoinTool = keyof typeof CLIP_EDITOR_PHASE_COIN_COSTS

export async function deductCoinsForUser(
  user: VerifiedUser,
  tool: ClipEditorPhaseCoinTool
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const cost = CLIP_EDITOR_PHASE_COIN_COSTS[tool]
  if (!Number.isFinite(cost)) {
    return { ok: false, reason: 'Invalid tool' }
  }

  if (hasUnlimitedAccess(user)) {
    const client = await clientPromise
    const db = client.db('sdhq')
    await db.collection('coinTransactions').insertOne({
      userId: user.username.toLowerCase(),
      username: user.username,
      type: 'spend',
      amount: 0,
      tool,
      balanceAfter: 999999,
      unlimited: true,
      role: user.role,
      timestamp: new Date().toISOString(),
    })
    return { ok: true }
  }

  const client = await clientPromise
  const db = client.db('sdhq')
  const balanceUserId = await resolveCoinBalanceUserId(db, user)
  const coinBalance = await db.collection('coinBalances').findOne({ userId: balanceUserId })
  if (!coinBalance || typeof coinBalance.coins !== 'number') {
    return { ok: false, reason: 'No coin balance found' }
  }
  if (coinBalance.coins < cost) {
    return { ok: false, reason: 'Insufficient coins' }
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
    return { ok: false, reason: 'Balance changed — please retry' }
  }

  await db.collection('coinTransactions').insertOne({
    userId: balanceUserId,
    username: user.username,
    type: 'spend',
    amount: -cost,
    tool,
    balanceAfter: result.value.coins,
    role: user.role,
    timestamp: new Date().toISOString(),
  })

  return { ok: true }
}
