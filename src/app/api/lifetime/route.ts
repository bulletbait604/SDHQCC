import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyStaffUser } from '@/lib/auth/staffAccess'

export async function POST(request: NextRequest) {
  try {
    await verifyStaffUser(request)

    const client = await clientPromise
    const db = client.db('sdhq')
    const { username, action } = await request.json()

    if (action === 'clear') {
      await db.collection('lifetimeMembers').deleteMany({})
      return NextResponse.json({ message: 'Lifetime members cleared successfully' })
    }

    if (!username || !action) {
      return NextResponse.json({ message: 'Username and action are required' }, { status: 400 })
    }

    const normalized = String(username).toLowerCase().trim()

    if (action === 'add') {
      await db.collection('lifetimeMembers').updateOne(
        { username: normalized },
        { $set: { username: normalized, addedAt: new Date().toISOString() } },
        { upsert: true }
      )
      return NextResponse.json({ message: 'Lifetime member added successfully' })
    }
    if (action === 'remove') {
      await db.collection('lifetimeMembers').deleteOne({ username: normalized })
      return NextResponse.json({ message: 'Lifetime member removed successfully' })
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('Failed to update lifetime members:', error)
    return NextResponse.json({ message: 'Failed to update lifetime members' }, { status: 500 })
  }
}
