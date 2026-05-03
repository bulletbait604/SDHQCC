import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { isAllowlistedOwner } from '@/lib/ownerAllowlist'

function canViewUserLists(role: string, username: string): boolean {
  return ['admin', 'owner'].includes(role) || isAllowlistedOwner(username)
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)

    if (!canViewUserLists(user.role, user.username)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const client = await clientPromise
    const db = client.db('sdhq')

    console.log('Fetching from database: sdhq')

    const subscribers = await db.collection('subscribers').find({}).toArray()
    const admins = await db.collection('admins').find({}).toArray()
    const lifetimeMembers = await db.collection('lifetimeMembers').find({}).toArray()

    const result = {
      subscribers: subscribers.map((s) => ({
        id: s._id.toString(),
        username: s.username,
        addedAt: s.addedAt,
      })),
      admins: admins.map((a) => ({
        id: a._id.toString(),
        username: a.username,
        addedAt: a.addedAt,
      })),
      lifetimeMembers: lifetimeMembers.map((l) => ({
        id: l._id.toString(),
        username: l.username,
        addedAt: l.addedAt,
      })),
    }

    console.log('API /api/users returning for authorized user:', user.username)
    return NextResponse.json(result)
  } catch (error: unknown) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('Error fetching user lists:', error)
    return NextResponse.json({ error: 'Failed to fetch user lists' }, { status: 500 })
  }
}
