import type { Db } from 'mongodb'
import clientPromise from '@/lib/mongodb'

export const ALGORITHM_SNAPSHOT_COLLECTION = 'algorithm_snapshots'
export const ALGORITHM_DOC_ID = 'current'

export type AlgorithmSnapshotPayload = {
  data: Record<string, unknown>
  lastUpdated: string | null
  provider?: string
  errors?: string[]
  /** True when a refresh only updated some platforms (prior data kept for the rest). */
  incomplete?: boolean
  model?: string
  updatedPlatforms?: string[]
}

export async function readAlgorithmSnapshotFromMongo(
  dbOverride?: Pick<Db, 'collection'>
): Promise<AlgorithmSnapshotPayload | null> {
  try {
    const db = dbOverride ?? (await clientPromise).db('sdhq')
    const doc = await db
      .collection(ALGORITHM_SNAPSHOT_COLLECTION)
      .findOne<{ payload: AlgorithmSnapshotPayload }>({ _id: ALGORITHM_DOC_ID })
    const payload = doc?.payload
    if (
      payload?.data &&
      typeof payload.data === 'object' &&
      Object.keys(payload.data).length > 0
    ) {
      return payload
    }
    return null
  } catch (e) {
    console.error('[AlgorithmSnapshot] MongoDB read failed:', e)
    return null
  }
}
