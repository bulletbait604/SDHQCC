import type { Db } from 'mongodb'
import type { VerifiedUser } from '@/lib/auth/verifyAuth'

/**
 * Coin balances are stored with userId = lowercase Kick username.
 * Migrates legacy rows keyed by Kick numeric id or Mongo user _id string.
 */
export async function resolveCoinBalanceUserId(
  db: Db,
  user: VerifiedUser
): Promise<string> {
  const canonical = user.username.toLowerCase()
  const legacyKick = String(user.id)

  let existing = await db.collection('coinBalances').findOne({ userId: canonical })
  if (existing) return canonical

  if (legacyKick && legacyKick !== canonical) {
    const byKick = await db.collection('coinBalances').findOne({ userId: legacyKick })
    if (byKick) {
      await db
        .collection('coinBalances')
        .updateOne({ userId: legacyKick }, { $set: { userId: canonical } })
      return canonical
    }
  }

  const u = await db.collection('users').findOne({ username: canonical })
  if (u?._id) {
    const oldKey = u._id.toString()
    const byOid = await db.collection('coinBalances').findOne({ userId: oldKey })
    if (byOid) {
      await db
        .collection('coinBalances')
        .updateOne({ userId: oldKey }, { $set: { userId: canonical } })
    }
  }

  return canonical
}
