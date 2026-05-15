import clientPromise from '@/lib/mongodb'
import { isAllowlistedOwner } from '@/lib/ownerAllowlist'
import { BANNED_USER_MESSAGE } from '@/lib/bannedUserMessage'

export { BANNED_USER_MESSAGE }

const COLLECTION = 'bannedUsers'

export function normalizeBanUsername(username: string): string {
  return username.trim().toLowerCase().replace(/^@/, '')
}

/** Owners on the allowlist cannot be banned via the UI/API. */
export function isBanExemptUsername(username: string): boolean {
  return isAllowlistedOwner(normalizeBanUsername(username))
}

export async function isUserBanned(username: string): Promise<boolean> {
  const normalized = normalizeBanUsername(username)
  if (!normalized) return false
  if (isBanExemptUsername(normalized)) return false

  const client = await clientPromise
  const db = client.db('sdhq')
  const row = await db.collection(COLLECTION).findOne({ username: normalized })
  return Boolean(row)
}

export type BannedUserRow = {
  username: string
  bannedAt: string
  bannedBy?: string
  reason?: string
}

export async function listBannedUsers(): Promise<BannedUserRow[]> {
  const client = await clientPromise
  const db = client.db('sdhq')
  const rows = await db
    .collection(COLLECTION)
    .find({})
    .sort({ bannedAt: -1 })
    .limit(500)
    .toArray()

  return rows.map((row) => ({
    username: String(row.username || ''),
    bannedAt: typeof row.bannedAt === 'string' ? row.bannedAt : new Date().toISOString(),
    bannedBy: typeof row.bannedBy === 'string' ? row.bannedBy : undefined,
    reason: typeof row.reason === 'string' ? row.reason : undefined,
  }))
}

export async function banUsername(params: {
  username: string
  bannedBy: string
}): Promise<void> {
  const normalized = normalizeBanUsername(params.username)
  if (!normalized) {
    throw new Error('Username is required')
  }
  if (isBanExemptUsername(normalized)) {
    throw new Error('That username cannot be banned (owner account).')
  }

  const client = await clientPromise
  const db = client.db('sdhq')
  await db.collection(COLLECTION).updateOne(
    { username: normalized },
    {
      $set: {
        username: normalized,
        bannedAt: new Date().toISOString(),
        bannedBy: normalizeBanUsername(params.bannedBy),
      },
    },
    { upsert: true }
  )
}

export async function unbanUsername(username: string): Promise<boolean> {
  const normalized = normalizeBanUsername(username)
  if (!normalized) return false
  const client = await clientPromise
  const db = client.db('sdhq')
  const result = await db.collection(COLLECTION).deleteOne({ username: normalized })
  return result.deletedCount > 0
}
