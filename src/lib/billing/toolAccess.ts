import type { Db } from 'mongodb'
import type { VerifiedUser } from '@/lib/auth/verifyAuth'
import { hasProAccess } from '@/lib/auth/verifyAuth'
import { refundToolCoins, spendToolCoins } from '@/lib/coins/spendToolCoins'
import { toolCoinCost, type ToolCoinName } from '@/lib/coins/toolCosts'
import { resolveCoinBalanceUserId } from '@/lib/coinUserId'
import {
  quotaRemaining,
  releaseQuota,
  tryConsumeQuota,
} from '@/lib/billing/freeQuota'
import {
  decideToolAccess,
  quotaBucketForTool,
  quotaLimitForBucket,
  type QuotaBucket,
} from '@/lib/billing/quotaRules'

export type AccessVia = 'pro' | 'quota' | 'coins'

export type ToolCharge =
  | {
      ok: true
      via: AccessVia
      deducted: number
      unlimited: boolean
      remainingCoins: number
      quotaBucket?: QuotaBucket
    }
  | { ok: false; status: number; reason: string; required?: number; available?: number }

export { decideToolAccess } from '@/lib/billing/quotaRules'

async function coinBalanceFor(db: Db, user: VerifiedUser): Promise<number> {
  const balanceUserId = await resolveCoinBalanceUserId(db, user)
  const row = await db.collection('coinBalances').findOne({ userId: balanceUserId })
  return typeof row?.coins === 'number' ? row.coins : 0
}

export async function previewToolAccess(
  db: Db,
  user: VerifiedUser,
  tool: ToolCoinName
): Promise<ToolCharge> {
  const cost = toolCoinCost(tool) ?? 0
  if (hasProAccess(user)) {
    return { ok: true, via: 'pro', deducted: 0, unlimited: true, remainingCoins: 999999 }
  }
  const bucket = quotaBucketForTool(tool)
  const limit = quotaLimitForBucket(bucket)
  const remaining = bucket ? await quotaRemaining(db, user.username, bucket) : 0
  const used = limit === null ? 0 : Math.max(0, limit - remaining)
  const coins = await coinBalanceFor(db, user)
  const decision = decideToolAccess({
    pro: false,
    quotaLimit: limit,
    quotaUsed: used,
    coinBalance: coins,
    coinCost: cost,
  })
  if (decision.via === 'denied') {
    return {
      ok: false,
      status: 403,
      reason: 'Insufficient coins',
      required: decision.required,
      available: decision.available,
    }
  }
  return {
    ok: true,
    via: decision.via,
    deducted: 0,
    unlimited: false,
    remainingCoins: coins,
    quotaBucket: bucket ?? undefined,
  }
}

/**
 * Charges a tool use. Pro (paid role or active trial) is free.
 * Analyses and tag generation spend the daily free quota first.
 * Thumbnails and other coin-only tools always spend coins unless the user has Pro.
 */
export async function chargeForTool(user: VerifiedUser, tool: ToolCoinName): Promise<ToolCharge> {
  if (hasProAccess(user)) {
    const spend = await spendToolCoins(user, tool)
    if (!spend.ok) return spend
    return { ...spend, via: 'pro' }
  }

  const bucket = quotaBucketForTool(tool)
  const limit = quotaLimitForBucket(bucket)
  if (bucket && limit !== null) {
    const consumed = await tryConsumeQuota(user.username, bucket, limit)
    if (consumed) {
      const { default: clientPromise } = await import('@/lib/mongodb')
      const client = await clientPromise
      const db = client.db('sdhq')
      const remainingCoins = await coinBalanceFor(db, user)
      return {
        ok: true,
        via: 'quota',
        deducted: 0,
        unlimited: false,
        remainingCoins,
        quotaBucket: bucket,
      }
    }
  }

  const spend = await spendToolCoins(user, tool)
  if (!spend.ok) return spend
  return { ...spend, via: 'coins' }
}

export async function refundToolCharge(
  user: VerifiedUser,
  tool: ToolCoinName,
  charge: ToolCharge
): Promise<void> {
  if (!charge.ok || charge.via === 'pro') return
  if (charge.via === 'quota' && charge.quotaBucket) {
    await releaseQuota(user.username, charge.quotaBucket)
    return
  }
  if (charge.via === 'coins' && charge.deducted > 0) {
    await refundToolCoins(user, tool, charge.deducted)
  }
}
