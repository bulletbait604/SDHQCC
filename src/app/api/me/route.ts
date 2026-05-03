import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, AuthError, createAuthErrorResponse, extractSessionToken } from '@/lib/auth/verifyAuth'

export const dynamic = 'force-dynamic'

type Preferences = {
  language?: string
  darkMode?: boolean
}

type KickOAuthDb = {
  provider?: string
  lastSyncedAt?: string
  userId?: string
  displayName?: string
  profileImageUrl?: string | null
  extras?: Record<string, string>
}

export async function GET(req: NextRequest) {
  // Anonymous visitors: return 200 so browsers/devtools don’t show failing /api/me requests
  if (!extractSessionToken(req)) {
    return NextResponse.json({
      user: null,
      subscription: {
        isVerified: false,
        isLifetime: false,
      },
      preferences: {
        language: 'en',
        darkMode: false,
      },
    })
  }

  try {
    const authUser = await verifyAuth(req)
    const client = await clientPromise
    const db = client.db('sdhq')

    const dbUser = await db.collection('users').findOne({ username: authUser.username })

    const uname = authUser.username
    const [subDoc, lifeDoc] = await Promise.all([
      db.collection('subscribers').findOne({ username: uname }),
      db.collection('lifetimeMembers').findOne({ username: uname }),
    ])

    const prefs = (dbUser?.preferences || {}) as Preferences
    const ko = dbUser?.kickOAuth as KickOAuthDb | undefined

    const displayName =
      (typeof dbUser?.display_name === 'string' && dbUser.display_name.trim()) ||
      (typeof ko?.displayName === 'string' && ko.displayName.trim()) ||
      (typeof dbUser?.displayName === 'string' && dbUser.displayName) ||
      authUser.username

    const profileUrl =
      (typeof dbUser?.profile_image_url === 'string' && dbUser.profile_image_url) ||
      (typeof ko?.profileImageUrl === 'string' && ko.profileImageUrl) ||
      undefined

    const kickUser = {
      id: String(dbUser?.kickId ?? authUser.id),
      username: authUser.username,
      display_name: displayName,
      profile_image_url: profileUrl,
      role: authUser.role,
      ...(ko?.lastSyncedAt
        ? {
            kick: {
              provider: (ko.provider || 'kick') as 'kick',
              lastSyncedAt: ko.lastSyncedAt,
              providerUserId: ko.userId ?? String(dbUser?.kickId ?? authUser.id),
              ...(ko.extras && Object.keys(ko.extras).length > 0 ? { extras: ko.extras } : {}),
            },
          }
        : {}),
    }

    return NextResponse.json({
      user: kickUser,
      subscription: {
        isVerified: !!subDoc,
        isLifetime: !!lifeDoc,
      },
      preferences: {
        language: prefs.language || 'en',
        darkMode: prefs.darkMode ?? false,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return createAuthErrorResponse(error)
    }
    console.error('[api/me GET]', error)
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authUser = await verifyAuth(req)
    const body = (await req.json()) as { preferences?: Partial<Preferences> }
    const incoming = body.preferences
    if (!incoming || typeof incoming !== 'object') {
      return NextResponse.json({ error: 'Missing preferences object' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('sdhq')
    const now = new Date().toISOString()

    const dbUser = await db.collection('users').findOne({ username: authUser.username })
    const prev = ((dbUser?.preferences || {}) as Preferences) || {}

    const next: Preferences = { ...prev }
    if (typeof incoming.language === 'string') next.language = incoming.language
    if (typeof incoming.darkMode === 'boolean') next.darkMode = incoming.darkMode

    await db.collection('users').updateOne(
      { username: authUser.username },
      {
        $set: {
          preferences: next,
          updatedAt: now,
        },
      }
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return createAuthErrorResponse(error)
    }
    console.error('[api/me PATCH]', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}
