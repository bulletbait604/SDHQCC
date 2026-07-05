import { randomBytes } from 'crypto'
import clientPromise from '@/lib/mongodb'
import { DESTINY_COLLECTIONS } from '@/lib/destiny/collections'

export interface BungieOAuthStateRecord {
  state: string
  userId: string
  redirectUri: string
  returnPath: string
  createdAt: Date
  expiresAt: Date
}

async function db() {
  const client = await clientPromise
  return client.db('sdhq')
}

export async function createBungieOAuthState(input: {
  userId: string
  redirectUri: string
  returnPath: string
}): Promise<string> {
  const state = randomBytes(24).toString('hex')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)

  await (await db()).collection(DESTINY_COLLECTIONS.oauthStates).insertOne({
    state,
    userId: input.userId.toLowerCase(),
    redirectUri: input.redirectUri,
    returnPath: input.returnPath,
    createdAt: now,
    expiresAt,
  })

  return state
}

export async function consumeBungieOAuthState(state: string): Promise<BungieOAuthStateRecord | null> {
  const row = await (await db())
    .collection(DESTINY_COLLECTIONS.oauthStates)
    .findOneAndDelete({
      state,
      expiresAt: { $gt: new Date() },
    })

  if (!row.value) return null

  const doc = row.value as unknown as BungieOAuthStateRecord
  return {
    state: doc.state,
    userId: doc.userId,
    redirectUri: doc.redirectUri,
    returnPath: doc.returnPath,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
  }
}
