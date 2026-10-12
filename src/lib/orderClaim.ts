import type { Db } from 'mongodb'

/**
 * Atomically claim an order id for one-time fulfillment.
 * Returns true only for the first caller; concurrent/replayed callers get false.
 * Relies on the always-unique `_id` index, so no migration is needed.
 */
export async function claimOrderOnce(
  db: Pick<Db, 'collection'>,
  collection: string,
  orderId: string
): Promise<boolean> {
  try {
    await db.collection(collection).insertOne({
      _id: orderId as unknown as never,
      claimedAt: new Date().toISOString(),
    })
    return true
  } catch (e) {
    if ((e as { code?: number })?.code === 11000) return false
    throw e
  }
}
