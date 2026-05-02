import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'

export const dynamic = 'force-dynamic'

type Preferences = {
  language?: string
  darkMode?: boolean
}

export async function GET(req: NextRequest) {
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

    const kickUser = {
      id: String(dbUser?.kickId ?? authUser.id),
      username: authUser.username,
      display_name:
        (typeof dbUser?.display_name === 'string' && dbUser.display_name) ||
        (typeof dbUser?.displayName === 'string' && dbUser.displayName) ||
        authUser.username,
      profile_image_url:
        typeof dbUser?.profile_image_url === 'string' ? dbUser.profile_image_url : undefined,
      role: authUser.role,
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
