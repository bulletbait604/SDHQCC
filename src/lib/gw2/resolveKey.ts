import type { VerifiedUser } from '@/lib/auth/verifyAuth'
import { isSiteOwner } from '@/lib/home/ownerIdentity'
import { readGw2ApiKey } from './env'
import type { Gw2LinkedKeyStatus } from './types'
import { readUserGw2Record } from './userKeys'

export async function resolveGw2KeyForUser(user: VerifiedUser): Promise<{
  key: string | null
  source: 'user' | 'env' | 'none'
  linkedKey: Gw2LinkedKeyStatus | null
}> {
  const stored = await readUserGw2Record(user)
  if (stored) {
    return { key: stored.plain, source: 'user', linkedKey: stored.meta }
  }
  if (isSiteOwner(user.username)) {
    const envKey = readGw2ApiKey()
    if (envKey) return { key: envKey, source: 'env', linkedKey: null }
  }
  return { key: null, source: 'none', linkedKey: null }
}
