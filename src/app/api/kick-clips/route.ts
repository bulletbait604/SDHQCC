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

function isLikelyPlayableVideoUrl(url: string): boolean {
  const u = url.toLowerCase()
  if (!u.startsWith('http')) return false
  if (u.includes('.m3u8')) return false
  if (u.includes('.mp4') || u.includes('/stream/') || u.includes('/vod/')) return true
  if (u.includes('thumbnail') || u.includes('.jpg') || u.includes('.jpeg') || u.includes('.png') || u.includes('.webp')) return false
  return u.includes('video') || u.includes('playback')
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

function collectPlayableVideoUrls(value: unknown, out: Set<string>) {
  if (!value) return
  if (typeof value === 'string') {
    if (isLikelyPlayableVideoUrl(value)) out.add(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPlayableVideoUrls(item, out)
    return
  }
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>
    for (const v of Object.values(rec)) collectPlayableVideoUrls(v, out)
  }
}

async function resolveClipVideoUrl(id: string, fallbackUrl: string | null): Promise<string | null> {
  const endpoints = [
    `https://kick.com/api/v2/clips/${encodeURIComponent(id)}`,
    `https://kick.com/api/v2/video_clips/${encodeURIComponent(id)}`,
  ]
  const found = new Set<string>()
  for (const url of endpoints) {
    const payload = await tryFetchJson(url)
    if (!payload) continue
    collectPlayableVideoUrls(payload, found)
    if (found.size > 0) break
  }
  if (found.size > 0) {
    const urls = Array.from(found)
    const mp4 = urls.find((u) => u.toLowerCase().includes('.mp4'))
    if (mp4) return mp4
    return urls[0]
  }
  if (fallbackUrl && isLikelyPlayableVideoUrl(fallbackUrl)) return fallbackUrl
  return null
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
      const baseClips = getClipRows(payload)
        .map(normalizeClip)
        .filter((row): row is KickClip => row !== null)
        .slice(0, 6)
      clips = await Promise.all(
        baseClips.map(async (clip) => ({
          ...clip,
          sourceVideoUrl: await resolveClipVideoUrl(clip.id, clip.sourceVideoUrl),
        }))
      )
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
