import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { isAllowlistedOwner } from '@/lib/ownerAllowlist'

function canManageAdmins(role: string, username: string): boolean {
  return ['admin', 'owner'].includes(role) || isAllowlistedOwner(username)
}

export async function POST(request: NextRequest) {
  try {
    const actor = await verifyAuth(request)

    if (!canManageAdmins(actor.role, actor.username)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const client = await clientPromise
    const db = client.db('sdhq')
    const { username, action } = await request.json()

    console.log('Admins API received:', { username, action, database: 'sdhq', actor: actor.username })

    if (action === 'clear') {
      await db.collection('admins').deleteMany({})
      return NextResponse.json({ message: 'Admins cleared successfully' })
    }

    if (!username || !action) {
      return NextResponse.json({ message: 'Username and action are required' }, { status: 400 })
    }

    if (action === 'add') {
      const result = await db.collection('admins').updateOne(
        { username: username.toLowerCase() },
        { $set: { username: username.toLowerCase(), addedAt: new Date().toISOString() } },
        { upsert: true }
      )
      console.log('Admin add result:', result)
      return NextResponse.json({ message: 'Admin added successfully' })
    }
    if (action === 'remove') {
      const result = await db.collection('admins').deleteOne({ username: username.toLowerCase() })
      console.log('Admin remove result:', result)
      return NextResponse.json({ message: 'Admin removed successfully' })
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
  } catch (error: unknown) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('Failed to update admins:', error)
    return NextResponse.json({ message: 'Failed to update admins', error: String(error) }, { status: 500 })
  }
}
