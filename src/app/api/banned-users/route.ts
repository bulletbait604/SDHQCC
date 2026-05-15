import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAuth,
  AuthError,
  createAuthErrorResponse,
} from '@/lib/auth/verifyAuth'
import { isAllowlistedOwner } from '@/lib/ownerAllowlist'
import {
  banUsername,
  listBannedUsers,
  normalizeBanUsername,
  unbanUsername,
} from '@/lib/bannedUsers'

export const dynamic = 'force-dynamic'

function isOwnerActor(role: string, username: string): boolean {
  return role === 'owner' || isAllowlistedOwner(username)
}

export async function GET(request: NextRequest) {
  try {
    const actor = await verifyAuth(request)
    if (!isOwnerActor(actor.role, actor.username)) {
      return NextResponse.json({ error: 'Only owners can view banned users' }, { status: 403 })
    }
    const banned = await listBannedUsers()
    return NextResponse.json({ banned })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[banned-users GET]', error)
    return NextResponse.json({ error: 'Failed to load banned users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await verifyAuth(request)
    if (!isOwnerActor(actor.role, actor.username)) {
      return NextResponse.json({ error: 'Only owners can manage banned users' }, { status: 403 })
    }

    const body = (await request.json()) as { username?: string; action?: string }
    const username = typeof body.username === 'string' ? body.username : ''
    const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : ''

    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 })
    }

    const normalized = normalizeBanUsername(username)
    if (normalized === normalizeBanUsername(actor.username)) {
      return NextResponse.json({ error: 'You cannot ban your own account' }, { status: 400 })
    }

    if (action === 'add' || action === 'ban') {
      await banUsername({ username: normalized, bannedBy: actor.username })
      return NextResponse.json({ message: 'User banned', username: normalized })
    }

    if (action === 'remove' || action === 'unban') {
      const removed = await unbanUsername(normalized)
      if (!removed) {
        return NextResponse.json({ error: 'User was not on the ban list' }, { status: 404 })
      }
      return NextResponse.json({ message: 'User unbanned', username: normalized })
    }

    return NextResponse.json({ error: 'action must be add or remove' }, { status: 400 })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    const message = error instanceof Error ? error.message : 'Failed to update ban list'
    console.error('[banned-users POST]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
