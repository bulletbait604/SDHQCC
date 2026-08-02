import clientPromise from '@/lib/mongodb'
import type { ActivityLogAction } from '@/lib/home/types'

const DB_NAME = 'sdhq'
const COLLECTION_NAME = 'activity-logs'
const MAX_LOGS = 500

export async function writeActivityLogEntry(entry: {
  username: string
  action: ActivityLogAction | string
  details: string
  estimatedCostUsd?: number
  estimatedCostNote?: string
}): Promise<void> {
  try {
    const client = await clientPromise
    const collection = client.db(DB_NAME).collection(COLLECTION_NAME)
    const newLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      username: entry.username,
      timestamp: new Date().toISOString(),
      action: entry.action,
      details: entry.details.slice(0, 2000),
      ...(typeof entry.estimatedCostUsd === 'number'
        ? { estimatedCostUsd: entry.estimatedCostUsd }
        : {}),
      ...(entry.estimatedCostNote
        ? { estimatedCostNote: entry.estimatedCostNote.slice(0, 600) }
        : {}),
    }
    await collection.insertOne(newLog)

    const count = await collection.countDocuments()
    if (count > MAX_LOGS) {
      const logsToDelete = await collection
        .find()
        .sort({ timestamp: 1 })
        .limit(count - MAX_LOGS)
        .toArray()
      await collection.deleteMany({
        _id: { $in: logsToDelete.map((log) => log._id) },
      })
    }
  } catch (error) {
    console.error('[activityLogWrite] Failed to write activity log:', error)
  }
}
