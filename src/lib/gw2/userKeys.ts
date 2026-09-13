import clientPromise from '@/lib/mongodb'
import type { VerifiedUser } from '@/lib/auth/verifyAuth'
import type { Gw2LinkedKeyStatus } from './types'
import { decryptGw2ApiKey, encryptGw2ApiKey, gw2KeyLastFour } from './keyCrypto'

const COLLECTION = 'gw2AccountKeys'

type StoredRow = Gw2LinkedKeyStatus & {
  userId: string
  username: string
  encryptedKey: string
}

async function col() {
  const client = await clientPromise
  return client.db('sdhq').collection<StoredRow>(COLLECTION)
}

function metaFromRow(row: StoredRow): Gw2LinkedKeyStatus {
  return {
    accountName: row.accountName || null,
    tokenName: row.tokenName || null,
    lastFour: row.lastFour,
    permissions: row.permissions || [],
    updatedAt: row.updatedAt,
  }
}

export async function readUserGw2Record(user: VerifiedUser): Promise<{
  plain: string
  meta: Gw2LinkedKeyStatus
} | null> {
  const row = await (await col()).findOne({ userId: user.id })
  if (!row?.encryptedKey) return null
  try {
    return { plain: decryptGw2ApiKey(row.encryptedKey), meta: metaFromRow(row) }
  } catch {
    return null
  }
}

export async function saveUserGw2Key(
  user: VerifiedUser,
  plainKey: string,
  extra: { accountName: string | null; tokenName: string | null; permissions: string[] }
): Promise<Gw2LinkedKeyStatus> {
  const stored: Gw2LinkedKeyStatus = {
    accountName: extra.accountName,
    tokenName: extra.tokenName,
    lastFour: gw2KeyLastFour(plainKey),
    permissions: extra.permissions,
    updatedAt: new Date().toISOString(),
  }
  await (
    await col()
  ).updateOne(
    { userId: user.id },
    {
      $set: {
        userId: user.id,
        username: user.username,
        encryptedKey: encryptGw2ApiKey(plainKey),
        ...stored,
      },
    },
    { upsert: true }
  )
  return stored
}

export async function deleteUserGw2Key(user: VerifiedUser): Promise<void> {
  await (await col()).deleteOne({ userId: user.id })
}
