import { getKickAppAccessToken } from '@/lib/kick/appAccessToken'
import {
  asRecord,
  mapOfficialChannel,
  mapWebChannel,
  mergeKickChannels,
  parseClipList,
  type KickChannelSnapshot,
  type KickClipCard,
} from '@/lib/kick/channelSnapshot'
import { emptyKickLeaderboard, emptyPeriod, parseGiftedSubsLeaderboard, parseKicksLeaderboard } from '@/lib/kick/leaderboard'

const FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'SDHQCC/1.0 (Creator Corner home dashboard)',
}

const CHANNEL_CACHE_MS = 30_000
const channelCache = new Map<string, { at: number; value: KickChannelSnapshot }>()

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: { ...FETCH_HEADERS, ...(init?.headers || {}) },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`${url} → ${response.status}`)
  }
  return response.json()
}

function firstRecord(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload)
  const rows = Array.isArray(root?.data) ? root.data : Array.isArray(payload) ? payload : []
  return asRecord(rows[0])
}

async function fetchOfficialChannel(slug: string): Promise<KickChannelSnapshot | null> {
  const token = await getKickAppAccessToken()
  const payload = await fetchJson(
    `https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(slug)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const first = firstRecord(payload)
  if (!first) return null
  const mapped = mapOfficialChannel(first, slug)
  const userId = typeof first.broadcaster_user_id === 'number' || typeof first.broadcaster_user_id === 'string'
    ? String(first.broadcaster_user_id)
    : ''
  if (!userId) return mapped
  try {
    const users = await fetchJson(`https://api.kick.com/public/v1/users?id=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const user = firstRecord(users)
    if (user) {
      const name = typeof user.name === 'string' && user.name.trim() ? user.name.trim() : null
      const picture =
        (typeof user.profile_picture === 'string' && user.profile_picture) ||
        (typeof user.profile_pic === 'string' && user.profile_pic) ||
        null
      if (name) mapped.displayName = name
      if (picture) mapped.profileImageUrl = picture
    }
  } catch (error) {
    console.warn('[Kick channel] users lookup failed:', error)
  }
  return mapped
}

async function fetchWebChannel(slug: string): Promise<KickChannelSnapshot | null> {
  try {
    const v1 = await fetchJson(`https://kick.com/api/v1/channels/${encodeURIComponent(slug)}`)
    const row = asRecord(v1)
    if (row) return mapWebChannel(row, slug)
  } catch (error) {
    console.warn('[Kick channel] Web v1 failed, trying v2:', error)
  }
  const web = await fetchJson(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`)
  const row = asRecord(web)
  if (!row) return null
  return mapWebChannel(row, slug)
}

export async function fetchKickChannel(
  slug: string,
  opts?: { fresh?: boolean }
): Promise<KickChannelSnapshot> {
  const safe = slug.replace(/^@/, '').toLowerCase().trim()
  if (!safe) throw new Error('Missing Kick username')

  if (!opts?.fresh) {
    const hit = channelCache.get(safe)
    if (hit && Date.now() - hit.at < CHANNEL_CACHE_MS) return hit.value
  }

  const [officialResult, webResult] = await Promise.allSettled([
    fetchOfficialChannel(safe),
    fetchWebChannel(safe),
  ])
  const official = officialResult.status === 'fulfilled' ? officialResult.value : null
  const web = webResult.status === 'fulfilled' ? webResult.value : null
  if (officialResult.status === 'rejected') {
    console.warn('[Kick channel] Public API failed:', officialResult.reason)
  }
  if (webResult.status === 'rejected') {
    console.warn('[Kick channel] Web API failed:', webResult.reason)
  }

  const merged = mergeKickChannels(official, web)
  channelCache.set(safe, { at: Date.now(), value: merged })
  return merged
}

export async function fetchKickClips(
  slug: string,
  limit = 25,
  channelId?: string | null
): Promise<KickClipCard[]> {
  const safe = slug.replace(/^@/, '').toLowerCase().trim()
  const capped = Math.min(25, Math.max(1, limit))
  const urls = [
    `https://kick.com/api/v2/channels/${encodeURIComponent(safe)}/clips?sort=date&limit=${capped}`,
    `https://kick.com/api/v2/channels/${encodeURIComponent(safe)}/clips?cursor=0`,
    `https://kick.com/api/v2/clips?channel=${encodeURIComponent(safe)}&limit=${capped}`,
    channelId && channelId !== safe
      ? `https://kick.com/api/v2/channels/${encodeURIComponent(channelId)}/clips?sort=date&limit=${capped}`
      : '',
    channelId ? `https://kick.com/api/v2/clips?channel_id=${encodeURIComponent(channelId)}&limit=${capped}` : '',
  ].filter(Boolean)

  for (const url of urls) {
    try {
      const payload = await fetchJson(url)
      const clips = parseClipList(payload, safe).slice(0, capped)
      if (clips.length > 0) return clips
    } catch (error) {
      console.warn('[Kick clips] endpoint failed:', url, error)
    }
  }

  return []
}

export async function fetchKickLeaderboards(slug: string, channelId?: string | null) {
  const safe = slug.replace(/^@/, '').toLowerCase().trim()
  if (!safe) return emptyKickLeaderboard()

  const kicksIds = [channelId, safe].filter((id, index, all): id is string => Boolean(id) && all.indexOf(id) === index)

  const [giftedResult, kicksResult] = await Promise.allSettled([
    fetchJson(`https://kick.com/api/v2/channels/${encodeURIComponent(safe)}/leaderboards`),
    (async () => {
      for (const id of kicksIds) {
        try {
          return await fetchJson(`https://kick.com/api/v1/kicks/${encodeURIComponent(id)}/leaderboard`)
        } catch (error) {
          console.warn('[Kick KICKs leaderboard] failed:', id, error)
        }
      }
      return null
    })(),
  ])

  return {
    giftedSubs:
      giftedResult.status === 'fulfilled' ? parseGiftedSubsLeaderboard(giftedResult.value) : emptyPeriod(),
    kicks:
      kicksResult.status === 'fulfilled' && kicksResult.value
        ? parseKicksLeaderboard(kicksResult.value)
        : emptyPeriod(),
  }
}
