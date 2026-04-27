import { NextRequest, NextResponse } from 'next/server'
import { MongoClient, Db } from 'mongodb'

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = 'sdhq'
const COLLECTION_NAME = 'activity-logs'

let client: MongoClient | null = null
let db: Db | null = null

async function getDb(): Promise<Db> {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set')
  }

  if (!client) {
    client = new MongoClient(MONGODB_URI)
    await client.connect()
    db = client.db(DB_NAME)
  }

  return db!
}

const MAX_LOGS = 500

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    const action = searchParams.get('action')
    const limit = parseInt(searchParams.get('limit') || '100')

    const database = await getDb()
    const collection = database.collection(COLLECTION_NAME)
    
    // Build query
    const query: any = {}
    if (username && username !== 'all') {
      query.username = username
    }
    if (action && action !== 'all') {
      query.action = action
    }
    
    // Fetch logs, sorted by timestamp (newest first)
    const logs = await collection
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()

    return NextResponse.json({ logs })
  } catch (error: any) {
    console.error('Error fetching activity logs:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch activity logs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, action, details } = body

    console.log('Activity log received:', { username, action, details })

    if (!username || !action) {
      return NextResponse.json({ error: 'Username and action are required' }, { status: 400 })
    }

    const newLog = {
      id: Date.now().toString(),
      username,
      timestamp: new Date().toISOString(),
      action,
      details: details || ''
    }

    const database = await getDb()
    const collection = database.collection(COLLECTION_NAME)
    
    // Insert new log
    await collection.insertOne(newLog)
    console.log('Successfully saved to MongoDB')
    
    // Get total count and trim if needed
    const count = await collection.countDocuments()
    if (count > MAX_LOGS) {
      // Delete oldest logs to maintain MAX_LOGS limit
      const logsToDelete = await collection
        .find()
        .sort({ timestamp: 1 })
        .limit(count - MAX_LOGS)
        .toArray()
      
      const idsToDelete = logsToDelete.map(log => log._id)
      await collection.deleteMany({ _id: { $in: idsToDelete } })
      console.log('Trimmed old logs, keeping only last', MAX_LOGS)
    }

    return NextResponse.json({ success: true, log: newLog })
  } catch (error: any) {
    console.error('Error logging activity:', error)
    return NextResponse.json({ error: error.message || 'Failed to log activity' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    const database = await getDb()
    const collection = database.collection(COLLECTION_NAME)

    if (username) {
      // Delete logs for a specific user
      await collection.deleteMany({ username })
    } else {
      // Clear all logs
      await collection.deleteMany({})
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error clearing activity logs:', error)
    return NextResponse.json({ error: error.message || 'Failed to clear activity logs' }, { status: 500 })
  }
}
