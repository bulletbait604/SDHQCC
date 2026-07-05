import clientPromise from '@/lib/mongodb'
import { DESTINY_COLLECTIONS } from '@/lib/destiny/collections'
import type { BungieOAuthTokens } from '@/lib/destiny/bungieOAuth'
import type { DestinyPlatform, DestinyUser } from '@/lib/destiny/types'

export interface StoredDestinyUser extends DestinyUser {
  bungieNetMembershipId?: string
  destinyMembershipType?: number
  oauth?: BungieOAuthTokens
  updatedAt?: string
}

async function db() {
  const client = await clientPromise
  return client.db('sdhq')
}

export async function getDestinyUserBySiteUserId(userId: string): Promise<StoredDestinyUser | null> {
  try {
    const row = await (await db()).collection(DESTINY_COLLECTIONS.users).findOne({ userId })
    return row as StoredDestinyUser | null
  } catch {
    return null
  }
}

export async function upsertDestinyUser(
  userId: string,
  data: Partial<StoredDestinyUser>
): Promise<StoredDestinyUser> {
  const database = await db()
  const now = new Date().toISOString()
  const doc: StoredDestinyUser = {
    userId,
    bungieMembershipId: data.bungieMembershipId ?? '',
    bungieDisplayName: data.bungieDisplayName ?? '',
    platform: data.platform ?? 'steam',
    connectedAt: data.connectedAt ?? now,
    ...data,
    updatedAt: now,
  }

  await database.collection(DESTINY_COLLECTIONS.users).updateOne(
    { userId },
    { $set: doc },
    { upsert: true }
  )

  return doc
}

export async function deleteDestinyUser(userId: string): Promise<void> {
  await (await db()).collection(DESTINY_COLLECTIONS.users).deleteOne({ userId })
}

export async function getValidAccessToken(stored: StoredDestinyUser): Promise<string | null> {
  if (!stored.oauth?.accessToken) return null

  const obtained = new Date(stored.oauth.obtainedAt).getTime()
  const expiresMs = (stored.oauth.expiresIn - 60) * 1000
  if (Date.now() < obtained + expiresMs) {
    return stored.oauth.accessToken
  }

  if (!stored.oauth.refreshToken) return null

  const { refreshBungieAccessToken } = await import('@/lib/destiny/bungieOAuth')
  const refreshed = await refreshBungieAccessToken(stored.oauth.refreshToken)
  await upsertDestinyUser(stored.userId, { oauth: refreshed })
  return refreshed.accessToken
}
