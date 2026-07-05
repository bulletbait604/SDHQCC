import clientPromise from '@/lib/mongodb'

export interface KickOAuthStateRecord {
  state: string
  codeVerifier: string
  redirectUri: string
  returnPath: string
  createdAt: Date
  expiresAt: Date
}

const COLLECTION = 'kick_oauth_states'

async function db() {
  const client = await clientPromise
  return client.db('sdhq')
}

export async function createKickOAuthState(input: {
  state: string
  codeVerifier: string
  redirectUri: string
  returnPath: string
}): Promise<void> {
  const now = new Date()
  await (await db()).collection(COLLECTION).insertOne({
    state: input.state,
    codeVerifier: input.codeVerifier,
    redirectUri: input.redirectUri,
    returnPath: input.returnPath,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
  })
}

export async function consumeKickOAuthState(state: string): Promise<KickOAuthStateRecord | null> {
  const row = await (await db()).collection(COLLECTION).findOneAndDelete({
    state,
    expiresAt: { $gt: new Date() },
  })

  if (!row.value) return null

  const doc = row.value as unknown as KickOAuthStateRecord
  return {
    state: doc.state,
    codeVerifier: doc.codeVerifier,
    redirectUri: doc.redirectUri,
    returnPath: doc.returnPath,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
  }
}
