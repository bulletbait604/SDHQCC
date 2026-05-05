import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, AuthError } from '@/lib/auth/verifyAuth'

export const dynamic = 'force-dynamic'

type KickClip = {
  id: string
  title: string
  thumbnailUrl: string | null
  clipUrl: string
  sourceVideoUrl: string | null
  createdAt: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function getString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function getClipRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((v) => asRecord(v) !== null) as Record<string, unknown>[]
  const root = asRecord(payload)
  if (!root) return []
  const nested = root.data ?? root.clips ?? root.results
  if (!Array.isArray(nested)) return []
  return nested.filter((v) => asRecord(v) !== null) as Record<string, unknown>[]
}

function normalizeClip(raw: Record<string, unknown>): KickClip | null {
  const idVal = raw.id ?? raw.clip_id ?? raw.uuid
  const id = idVal == null ? null : String(idVal)
  const title = getString(raw.title, raw.clip_title, raw.description, 'Kick Clip')
  const clipUrl = getString(raw.clip_url, raw.url, raw.permalink, raw.link)
  const thumbnailUrl = getString(raw.thumbnail_url, raw.thumbnail, raw.poster_url)
  const sourceVideoUrl = getString(raw.video_url, raw.source_url, raw.playback_url, raw.mp4_url)
  const createdAt = getString(raw.created_at, raw.createdAt)

  if (!id || !clipUrl) return null

  return {
    id,
    title: title || 'Kick Clip',
    thumbnailUrl: thumbnailUrl || null,
    clipUrl,
    sourceVideoUrl: sourceVideoUrl || null,
    createdAt: createdAt || null,
  }
}

async function tryFetchJson(url: string): Promise<unknown | null> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SDHQ-Creator-Corner/1.0',
    },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)

    const mongo = await clientPromise
    const db = mongo.db('sdhq')
    const dbUser = await db.collection('users').findOne({ username: user.username })
    const kickId = typeof dbUser?.kickId === 'string' ? dbUser.kickId : null
    const username = user.username.replace(/^@/, '').toLowerCase()

    const candidates = [
      `https://kick.com/api/v2/channels/${encodeURIComponent(username)}/clips?limit=6`,
      `https://kick.com/api/v2/channels/${encodeURIComponent(username)}/clips?page=1&limit=6`,
      ...(kickId ? [`https://kick.com/api/v2/channels/${encodeURIComponent(kickId)}/clips?limit=6`] : []),
    ]

    let clips: KickClip[] = []
    for (const url of candidates) {
      const payload = await tryFetchJson(url)
      if (!payload) continue
      clips = getClipRows(payload).map(normalizeClip).filter((row): row is KickClip => row !== null).slice(0, 6)
      if (clips.length > 0) break
    }

    const response = NextResponse.json({ clips })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[api/kick-clips GET]', error)
    return NextResponse.json({ error: 'Failed to load Kick clips' }, { status: 500 })
  }
}
