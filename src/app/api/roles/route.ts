import type { Db } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import {
  verifyAuth,
  AuthError,
  createAuthErrorResponse,
  type VerifiedUser,
} from '@/lib/auth/verifyAuth'
import { isStaffRole, verifyStaffUser } from '@/lib/auth/staffAccess'
import { isAllowlistedOwner } from '@/lib/ownerAllowlist'
import { capOwnerRole } from '@/lib/home/ownerIdentity'
import type { Role as HomeRole } from '@/lib/home/roles'

async function requesterCanViewAllUserCoins(req: NextRequest, db: Db): Promise<boolean> {
  try {
    const u = await verifyAuth(req)
    if (isStaffRole(u.role) || isAllowlistedOwner(u.username)) return true
    const row = await db.collection('users').findOne({ username: u.username })
    return isStaffRole(row?.role as string | undefined)
  } catch {
    return false
  }
}

const ROLE_HIERARCHY = {
  free: 1,
  subscriber: 2,
  subscriber_lifetime: 3,
  editor: 4,
  admin: 5,
  owner: 6,
} as const

type Role = keyof typeof ROLE_HIERARCHY

function canAssignRole(actor: VerifiedUser, targetRole: Role): boolean {
  if (targetRole === 'owner') {
    return actor.role === 'owner' || isAllowlistedOwner(actor.username)
  }
  if (targetRole === 'admin') {
    return actor.role === 'owner' || isAllowlistedOwner(actor.username)
  }
  return isStaffRole(actor.role) || isAllowlistedOwner(actor.username)
}

export async function POST(request: NextRequest) {
  try {
    const actor = await verifyStaffUser(request)
    const client = await clientPromise
    const db = client.db('sdhq')

    const { username, role } = await request.json()

    if (!username || !role) {
      return NextResponse.json({ message: 'Username and role are required' }, { status: 400 })
    }

    if (!ROLE_HIERARCHY[role as Role]) {
      return NextResponse.json({ message: 'Invalid role' }, { status: 400 })
    }

    if (!canAssignRole(actor, role as Role)) {
      return NextResponse.json({ message: 'Forbidden — insufficient privileges for this role' }, { status: 403 })
    }

    const normalizedUsername = String(username).toLowerCase().trim()

    if (role === 'owner' && !isAllowlistedOwner(normalizedUsername)) {
      return NextResponse.json(
        { message: 'Owner role is reserved for the site owner account (Bulletbait604)' },
        { status: 403 }
      )
    }

    await db.collection('users').updateOne(
      { username: normalizedUsername },
      {
        $set: {
          username: normalizedUsername,
          role,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    )

    if (role === 'free') {
      await db.collection('subscribers').deleteOne({ username: normalizedUsername })
      await db.collection('lifetimeMembers').deleteOne({ username: normalizedUsername })
    }

    const updatedUser = await db.collection('users').findOne({ username: normalizedUsername })

    return NextResponse.json({
      message: `User role updated to ${role}`,
      role,
      verified: updatedUser,
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('Failed to update user role:', error)
    return NextResponse.json({ message: 'Failed to update user role' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await verifyAuth(request)
    const client = await clientPromise
    const db = client.db('sdhq')

    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (username) {
      const normalized = username.toLowerCase()
      const user = await db.collection('users').findOne({ username: normalized })
      if (!user) {
        return NextResponse.json({ user: null })
      }

      let isStaff =
        isStaffRole(sessionUser.role) || isAllowlistedOwner(sessionUser.username)
      if (!isStaff) {
        const actorRow = await db.collection('users').findOne({ username: sessionUser.username })
        isStaff = isStaffRole(actorRow?.role as string | undefined)
      }
      const isSelf = sessionUser.username === normalized
      if (!isStaff && !isSelf) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      let coins: number | undefined
      if (isStaff || isSelf) {
        const row = await db.collection('coinBalances').findOne({ userId: normalized })
        coins = typeof row?.coins === 'number' ? row.coins : 0
      }

      return NextResponse.json({
        user: {
          role: capOwnerRole(String(user.username), user.role as HomeRole),
          username: user.username,
          ...(coins !== undefined ? { coins } : {}),
        },
      })
    }

    await verifyStaffUser(request)

    const users = await db.collection('users').find({}).toArray()
    const includeCoins = await requesterCanViewAllUserCoins(request, db)

    let coinsByUser = new Map<string, number>()
    if (includeCoins) {
      const usernames = users
        .map((u) => String(u.username ?? '').toLowerCase())
        .filter((s) => s.length > 0)
      if (usernames.length > 0) {
        const balanceRows = await db
          .collection('coinBalances')
          .find({ userId: { $in: usernames } })
          .project({ userId: 1, coins: 1 })
          .toArray()
        for (const row of balanceRows) {
          const id = String(row.userId ?? '').toLowerCase()
          if (id) {
            coinsByUser.set(id, typeof row.coins === 'number' ? row.coins : 0)
          }
        }
      }
    }

    return NextResponse.json({
      users: users.map((u) => {
        const un = String(u.username ?? '').toLowerCase()
        const base = {
          id: u._id.toString(),
          username: u.username,
          role: capOwnerRole(String(u.username ?? ''), u.role as HomeRole),
          updatedAt: u.updatedAt,
        }
        if (includeCoins) {
          return { ...base, coins: coinsByUser.get(un) ?? 0 }
        }
        return base
      }),
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('Error fetching user roles:', error)
    return NextResponse.json({ error: 'Failed to fetch user roles' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await verifyStaffUser(request)

    const client = await clientPromise
    const db = client.db('sdhq')
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (!username) {
      return NextResponse.json({ message: 'Username is required' }, { status: 400 })
    }

    const normalizedUsername = username.toLowerCase()
    const result = await db.collection('users').deleteOne({ username: normalizedUsername })

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('Failed to delete user:', error)
    return NextResponse.json({ message: 'Failed to delete user' }, { status: 500 })
  }
}
