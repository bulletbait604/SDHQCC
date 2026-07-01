import clientPromise from '@/lib/mongodb'
import type { TradebotSnapshot } from '@/lib/tradebot/types'

export const TRADEBOT_SNAPSHOT_COLLECTION = 'tradebot_snapshots'
export const TRADEBOT_SNAPSHOT_ID = 'latest'

export async function readTradebotSnapshot(): Promise<TradebotSnapshot | null> {
  try {
    const client = await clientPromise
    const doc = await client
      .db('sdhq')
      .collection(TRADEBOT_SNAPSHOT_COLLECTION)
      .findOne<{ payload: TradebotSnapshot }>({ _id: TRADEBOT_SNAPSHOT_ID })
    return doc?.payload ?? null
  } catch (error) {
    console.error('[tradebot] Mongo read failed:', error)
    return null
  }
}

export async function writeTradebotSnapshot(payload: TradebotSnapshot): Promise<void> {
  const client = await clientPromise
  await client
    .db('sdhq')
    .collection(TRADEBOT_SNAPSHOT_COLLECTION)
    .updateOne(
      { _id: TRADEBOT_SNAPSHOT_ID },
      {
        $set: {
          payload,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    )
}
