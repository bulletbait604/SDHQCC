import crypto from 'crypto'
import clientPromise from '@/lib/mongodb'

const COLLECTION = 'twitch_oauth_states'

export function createOAuthState(): string {
  return crypto.randomBytes(24).toString('hex')
}

async function db() {
  const client = await clientPromise
  return client.db('sdhq')
}

export async function createTwitchOAuthState(input: {
  state: string
  redirectUri: string
  returnPath: string
}): Promise<void> {
  const now = new Date()
  await (await db()).collection(COLLECTION).insertOne({
    state: input.state,
    redirectUri: input.redirectUri,
    returnPath: input.returnPath,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
  })
}

export async function consumeTwitchOAuthState(state: string): Promise<{
  redirectUri: string
  returnPath: string
} | null> {
  const row = await (await db()).collection(COLLECTION).findOneAndDelete({
    state,
    expiresAt: { $gt: new Date() },
  })
  const doc = row.value as { redirectUri?: string; returnPath?: string } | null
  if (!doc?.redirectUri) return null
  return {
    redirectUri: doc.redirectUri,
    returnPath: typeof doc.returnPath === 'string' ? doc.returnPath : '/',
  }
}
