import { NextRequest, NextResponse } from 'next/server'
import { MongoClient, Db } from 'mongodb'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { isAllowlistedOwner } from '@/lib/ownerAllowlist'
import { INTERNAL_API_SECRET_HEADER, isValidInternalApiSecret } from '@/lib/internalApi'

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

function canViewAllActivity(role: string, username: string): boolean {
  return ['admin', 'owner'].includes(role) || isAllowlistedOwner(username)
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)

    const { searchParams } = new URL(request.url)
    let username = searchParams.get('username')
    const action = searchParams.get('action')
    const rawLimit = parseInt(searchParams.get('limit') || '100', 10)
    const limit = Math.min(Number.isFinite(rawLimit) ? rawLimit : 100, MAX_LOGS)

    const database = await getDb()
    const collection = database.collection(COLLECTION_NAME)

    const query: Record<string, string> = {}

    if (!canViewAllActivity(user.role, user.username)) {
      query.username = user.username
    } else {
      if (username && username !== 'all') {
        query.username = username
      }
    }

    if (action && action !== 'all') {
      query.action = action
    }

    const logs = await collection.find(query).sort({ timestamp: -1 }).limit(limit).toArray()

    return NextResponse.json({ logs })
  } catch (error: unknown) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('Error fetching activity logs:', error)
    const msg = error instanceof Error ? error.message : 'Failed to fetch activity logs'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const secretHeader = request.headers.get(INTERNAL_API_SECRET_HEADER)

    let username: string
    let action: string
    let details: string

    if (isValidInternalApiSecret(secretHeader)) {
      username = body.username
      action = body.action
      details = body.details ?? ''
      if (!username || !action) {
        return NextResponse.json({ error: 'Username and action are required' }, { status: 400 })
      }
    } else {
      const user = await verifyAuth(request)
      action = body.action
      details = body.details ?? ''
      if (!action) {
        return NextResponse.json({ error: 'Action is required' }, { status: 400 })
      }
      username = user.username
    }

    console.log('Activity log received:', { username, action, details })

    const newLog = {
      id: Date.now().toString(),
      username,
      timestamp: new Date().toISOString(),
      action,
      details,
    }

    const database = await getDb()
    const collection = database.collection(COLLECTION_NAME)

    await collection.insertOne(newLog)
    console.log('Successfully saved to MongoDB')

    const count = await collection.countDocuments()
    if (count > MAX_LOGS) {
      const logsToDelete = await collection.find().sort({ timestamp: 1 }).limit(count - MAX_LOGS).toArray()

      const idsToDelete = logsToDelete.map((log) => log._id)
      await collection.deleteMany({ _id: { $in: idsToDelete } })
      console.log('Trimmed old logs, keeping only last', MAX_LOGS)
    }

    return NextResponse.json({ success: true, log: newLog })
  } catch (error: unknown) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('Error logging activity:', error)
    const msg = error instanceof Error ? error.message : 'Failed to log activity'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAuth(request)

    if (!canViewAllActivity(user.role, user.username)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    const database = await getDb()
    const collection = database.collection(COLLECTION_NAME)

    if (username) {
      await collection.deleteMany({ username })
    } else {
      await collection.deleteMany({})
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('Error clearing activity logs:', error)
    const msg = error instanceof Error ? error.message : 'Failed to clear activity logs'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
