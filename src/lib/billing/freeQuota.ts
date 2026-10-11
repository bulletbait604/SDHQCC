import type { Db } from 'mongodb'
import clientPromise from '@/lib/mongodb'
import {
  quotaLimitForBucket,
  utcQuotaDay,
  type QuotaBucket,
} from '@/lib/billing/quotaRules'

export type { QuotaBucket } from '@/lib/billing/quotaRules'
export { quotaBucketForTool, quotaLimitForBucket, utcQuotaDay } from '@/lib/billing/quotaRules'

async function db(): Promise<Db> {
  const client = await clientPromise
  return client.db('sdhq')
}

export async function quotaRemaining(
  database: Db,
  username: string,
  bucket: QuotaBucket,
  now: Date = new Date()
): Promise<number> {
  const userId = username.replace(/^@/, '').toLowerCase()
  const day = utcQuotaDay(now)
  const doc = await database.collection('usageQuotas').findOne({ userId, day })
  const counts = (doc?.counts || {}) as Record<string, unknown>
  const used = typeof counts[bucket] === 'number' ? counts[bucket] : 0
  const limit = quotaLimitForBucket(bucket) ?? 0
  return Math.max(0, limit - used)
}

export async function readFreeQuota(username: string, now: Date = new Date()) {
  const database = await db()
  const [analysisRemaining, tagRemaining] = await Promise.all([
    quotaRemaining(database, username, 'analysis', now),
    quotaRemaining(database, username, 'tags', now),
  ])
  return {
    analysisLimit: quotaLimitForBucket('analysis') ?? 0,
    analysisRemaining,
    tagLimit: quotaLimitForBucket('tags') ?? 0,
    tagRemaining,
    day: utcQuotaDay(now),
  }
}

export async function tryConsumeQuota(
  username: string,
  bucket: QuotaBucket,
  limit: number,
  now: Date = new Date()
): Promise<boolean> {
  const database = await db()
  const userId = username.replace(/^@/, '').toLowerCase()
  const day = utcQuotaDay(now)
  const field = `counts.${bucket}`
  await database.collection('usageQuotas').updateOne(
    { userId, day },
    {
      $setOnInsert: {
        userId,
        day,
        counts: {},
        createdAt: now.toISOString(),
      },
    },
    { upsert: true }
  )
  const result = await database.collection('usageQuotas').updateOne(
    {
      userId,
      day,
      $expr: { $lt: [{ $ifNull: [`$${field}`, 0] }, limit] },
    },
    { $inc: { [field]: 1 }, $set: { updatedAt: now.toISOString() } }
  )
  return result.modifiedCount === 1
}

export async function releaseQuota(
  username: string,
  bucket: QuotaBucket,
  now: Date = new Date()
): Promise<void> {
  const database = await db()
  const userId = username.replace(/^@/, '').toLowerCase()
  const day = utcQuotaDay(now)
  const field = `counts.${bucket}`
  await database.collection('usageQuotas').updateOne(
    { userId, day, [field]: { $gt: 0 } },
    { $inc: { [field]: -1 }, $set: { updatedAt: now.toISOString() } }
  )
}

