import clientPromise from '@/lib/mongodb'
import type { VerifiedUser } from '@/lib/auth/verifyAuth'
import { hasUnlimitedAccess } from '@/lib/auth/verifyAuth'
import { resolveCoinBalanceUserId } from '@/lib/coinUserId'
import { splitCoinSpend } from '@/lib/coinPurchasedBalance'
import { toolCoinCost, type ToolCoinName } from '@/lib/coins/toolCosts'

export type SpendToolCoinsResult =
  | { ok: true; deducted: number; unlimited: boolean; remainingCoins: number }
  | { ok: false; status: number; reason: string; required?: number; available?: number }

/** Deduct coins for a tool using session user — call after verifyAuth. */
export async function spendToolCoins(
  user: VerifiedUser,
  tool: ToolCoinName,
  amountOverride?: number
): Promise<SpendToolCoinsResult> {
  const listed = toolCoinCost(tool)
  if (listed === undefined && amountOverride === undefined) {
    return { ok: false, status: 400, reason: 'Invalid tool' }
  }
  const cost =
    typeof amountOverride === 'number' && Number.isFinite(amountOverride) && amountOverride >= 0
      ? Math.floor(amountOverride)
      : listed ?? 0

  const client = await clientPromise
  const db = client.db('sdhq')

  if (hasUnlimitedAccess(user)) {
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
    return { ok: true, deducted: 0, unlimited: true, remainingCoins: 999999 }
  }

  if (cost === 0) {
    const balanceUserId = await resolveCoinBalanceUserId(db, user)
    const row = await db.collection('coinBalances').findOne({ userId: balanceUserId })
    const remaining = typeof row?.coins === 'number' ? row.coins : 0
    await db.collection('coinTransactions').insertOne({
      userId: balanceUserId,
      username: user.username,
      type: 'spend',
      amount: 0,
      tool,
      balanceAfter: remaining,
      role: user.role,
      timestamp: new Date().toISOString(),
    })
    return { ok: true, deducted: 0, unlimited: false, remainingCoins: remaining }
  }

  const balanceUserId = await resolveCoinBalanceUserId(db, user)
  const coinBalance = await db.collection('coinBalances').findOne({ userId: balanceUserId })
  if (!coinBalance || typeof coinBalance.coins !== 'number') {
    return { ok: false, status: 404, reason: 'No coin balance found' }
  }
  if (coinBalance.coins < cost) {
    return {
      ok: false,
      status: 403,
      reason: 'Insufficient coins',
      required: cost,
      available: coinBalance.coins,
    }
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
    return { ok: false, status: 409, reason: 'Balance changed — please retry', required: cost }
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

  return {
    ok: true,
    deducted: cost,
    unlimited: false,
    remainingCoins: result.value.coins,
  }
}

/** Credit coins back after a failed generation (no-op if nothing was deducted). */
export async function refundToolCoins(
  user: VerifiedUser,
  tool: string,
  amount: number
): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) return
  if (hasUnlimitedAccess(user)) return

  const client = await clientPromise
  const db = client.db('sdhq')
  const balanceUserId = await resolveCoinBalanceUserId(db, user)
  const result = await db.collection('coinBalances').findOneAndUpdate(
    { userId: balanceUserId },
    {
      $inc: { coins: amount, totalSpent: -amount },
      $set: { updatedAt: new Date().toISOString() },
    },
    { returnDocument: 'after' }
  )

  await db.collection('coinTransactions').insertOne({
    userId: balanceUserId,
    username: user.username,
    type: 'refund',
    amount,
    tool,
    balanceAfter: typeof result?.value?.coins === 'number' ? result.value.coins : null,
    role: user.role,
    timestamp: new Date().toISOString(),
  })
}
