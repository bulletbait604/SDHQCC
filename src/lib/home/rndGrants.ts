import clientPromise from '@/lib/mongodb'
import { normalizeKickUsername } from '@/lib/home/ownerIdentity'
import {
  GRANTABLE_RND_TABS,
  sanitizeRndTabs,
  type GrantableRndTab,
} from '@/lib/home/rndAccess'

export type RndGrantRow = {
  username: string
  tabs: GrantableRndTab[]
}

export async function readGrantedRndTabs(username: string): Promise<GrantableRndTab[]> {
  const normalized = normalizeKickUsername(username)
  if (!normalized) return []
  const client = await clientPromise
  const row = await client.db('sdhq').collection('users').findOne({ username: normalized })
  return sanitizeRndTabs(row?.rndTabs)
}

export async function listRndGrants(): Promise<RndGrantRow[]> {
  const client = await clientPromise
  const rows = await client
    .db('sdhq')
    .collection('users')
    .find({ rndTabs: { $exists: true, $ne: [] } })
    .project({ username: 1, rndTabs: 1 })
    .toArray()
  return rows
    .map((row) => ({
      username: normalizeKickUsername(String(row.username || '')),
      tabs: sanitizeRndTabs(row.rndTabs),
    }))
    .filter((row) => row.username && row.tabs.length > 0)
}

export async function saveRndGrant(username: string, tabs: unknown): Promise<GrantableRndTab[]> {
  const normalized = normalizeKickUsername(username)
  if (!normalized) throw new Error('Username is required')
  const next = sanitizeRndTabs(tabs)
  const client = await clientPromise
  const db = client.db('sdhq')
  const now = new Date().toISOString()
  await db.collection('users').updateOne(
    { username: normalized },
    {
      $set: {
        username: normalized,
        rndTabs: next,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  )
  return next
}

export function allGrantableRndTabs(): GrantableRndTab[] {
  return [...GRANTABLE_RND_TABS]
}
