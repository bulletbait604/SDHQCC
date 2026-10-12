import type { Db } from 'mongodb'
import clientPromise from '@/lib/mongodb'
import {
  ALGORITHM_DOC_ID,
  ALGORITHM_SNAPSHOT_COLLECTION,
  readAlgorithmSnapshotFromMongo,
  type AlgorithmSnapshotPayload,
} from '@/lib/algorithmSnapshotRead'
import seedJson from '../../../algorithm-data.json'

/**
 * Algorithm research data lives in MongoDB (`sdhq.algorithm_snapshots`, _id "current").
 * The repo's algorithm-data.json (~35 KB, far below the 16 MB document limit) is bundled
 * as a read-only seed: used when Mongo is empty/unreachable and written into Mongo
 * once so the DB becomes the single source of truth. No GitHub reads or writes.
 */
export const ALGORITHM_SEED: AlgorithmSnapshotPayload = seedJson as AlgorithmSnapshotPayload

type DbLike = Pick<Db, 'collection'>

async function getDb(dbOverride?: DbLike): Promise<DbLike> {
  return dbOverride ?? (await clientPromise).db('sdhq')
}

export async function writeAlgorithmSnapshot(
  payload: AlgorithmSnapshotPayload,
  dbOverride?: DbLike
): Promise<void> {
  const db = await getDb(dbOverride)
  await db.collection(ALGORITHM_SNAPSHOT_COLLECTION).updateOne(
    { _id: ALGORITHM_DOC_ID as unknown as never },
    { $set: { payload, updatedAt: new Date().toISOString() } },
    { upsert: true }
  )
}

/** Mongo first; otherwise the bundled seed (and seed Mongo if it is reachable but empty). */
export async function readAlgorithmSnapshot(dbOverride?: DbLike): Promise<AlgorithmSnapshotPayload> {
  let db: DbLike | null = null
  try {
    db = await getDb(dbOverride)
  } catch (e) {
    console.error('[Algorithms] MongoDB unavailable, using bundled seed:', e)
  }
  if (db) {
    const fromMongo = await readAlgorithmSnapshotFromMongo(db)
    if (fromMongo) return fromMongo
    try {
      const existing = await db
        .collection(ALGORITHM_SNAPSHOT_COLLECTION)
        .findOne({ _id: ALGORITHM_DOC_ID as unknown as never })
      if (!existing) await writeAlgorithmSnapshot(ALGORITHM_SEED, db)
    } catch (e) {
      console.error('[Algorithms] Seeding MongoDB failed:', e)
    }
  }
  return ALGORITHM_SEED
}
