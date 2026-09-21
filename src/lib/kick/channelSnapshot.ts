import {
  extractSocialsFromKickLinks,
  extractSocialsFromKickUser,
  extractSocialsFromText,
  mergeSocials,
  type ExtractedSocial,
} from '@/lib/kick/extractSocials'

export type KickChannelSnapshot = {
  slug: string
  displayName: string
  profileImageUrl: string | null
  bannerUrl: string | null
  description: string
  isLive: boolean
  streamTitle: string | null
  category: string | null
  viewerCount: number | null
  startedAt: string | null
  lastLiveAt: string | null
  liveThumbnailUrl: string | null
  subscriberCount: number | null
  followersCount: number | null
  channelId: string | null
  recentCategories: string[]
  socials: ExtractedSocial[]
  playerEmbedUrl: string
  channelUrl: string
  source: 'kick-public-api' | 'kick-web-api' | 'kick-merged'
}

export type KickClipCard = {
  id: string
  title: string
  thumbnailUrl: string | null
  clipUrl: string
  videoUrl: string | null
  createdAt: string | null
  durationSeconds: number | null
  views: number | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function asBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1
}

export function mapOfficialChannel(
  row: Record<string, unknown>,
  fallbackSlug: string
): KickChannelSnapshot {
  const stream = asRecord(row.stream) || {}
  const category = asRecord(row.category)
  const slug = asString(row.slug) || fallbackSlug
  const isLive = asBool(stream.is_live)
  return {
    slug,
    displayName: slug,
    profileImageUrl: null,
    bannerUrl: asString(row.banner_picture),
    description: asString(row.channel_description) || '',
    isLive,
    streamTitle: asString(row.stream_title) || asString(stream.title),
    category: asString(category?.name),
    viewerCount: asNumber(stream.viewer_count),
    startedAt: asString(stream.start_time),
    lastLiveAt: isLive ? asString(stream.start_time) : null,
    liveThumbnailUrl: asString(stream.thumbnail),
    subscriberCount: asNumber(row.active_subscribers_count),
    followersCount: null,
    channelId: asString(row.id),
    recentCategories: [],
    socials: [],
    playerEmbedUrl: `https://player.kick.com/${encodeURIComponent(slug)}`,
    channelUrl: `https://kick.com/${slug}`,
    source: 'kick-public-api',
  }
}

function recentCategoryNames(row: Record<string, unknown>): string[] {
  const list = Array.isArray(row.recent_categories) ? row.recent_categories : []
  const names: string[] = []
  for (const item of list) {
    const rec = asRecord(item)
    if (!rec || rec.is_fallback) continue
    const name = asString(rec.name)
    if (name && !names.includes(name)) names.push(name)
  }
  return names.slice(0, 8)
}

export function mapWebChannel(
  row: Record<string, unknown>,
  fallbackSlug: string
): KickChannelSnapshot {
  const user = asRecord(row.user) || {}
  const livestream = asRecord(row.livestream)
  const previousList = Array.isArray(row.previous_livestreams) ? row.previous_livestreams : []
  const previous = asRecord(row.previous_livestream) || asRecord(previousList[0])
  const liveBlock = livestream || previous
  const offlineBanner = asRecord(row.offline_banner_image)
  const liveBanner = asRecord(row.banner_image) || asRecord(row.banner)
  const slug = asString(row.slug) || asString(user.username) || fallbackSlug
  const isLive = Boolean(livestream)
  const recentCategories = recentCategoryNames(row)
  const description = asString(user.bio) || asString(row.bio) || ''
  const socials = mergeSocials(
    extractSocialsFromKickUser(user),
    extractSocialsFromKickLinks(row.ascending_links),
    extractSocialsFromText(description)
  )
  return {
    slug,
    displayName: asString(user.username) || slug,
    profileImageUrl: asString(user.profile_pic) || asString(user.profile_picture),
    bannerUrl: isLive
      ? asString(liveBanner?.url) || asString(offlineBanner?.src)
      : asString(offlineBanner?.src) || asString(liveBanner?.url) || asString(liveBanner?.src),
    description,
    isLive,
    streamTitle:
      asString(liveBlock?.session_title) ||
      asString(liveBlock?.title) ||
      asString(row.session_title),
    category:
      asString(asRecord(liveBlock?.category)?.name) ||
      asString(asRecord(liveBlock?.categories)?.name) ||
      recentCategories[0] ||
      null,
    viewerCount: asNumber(liveBlock?.viewer_count) || asNumber(liveBlock?.viewers),
    startedAt: livestream
      ? asString(livestream.created_at) || asString(livestream.start_time)
      : null,
    lastLiveAt:
      asString(liveBlock?.created_at) ||
      asString(liveBlock?.start_time) ||
      asString(previous?.created_at),
    liveThumbnailUrl:
      asString(asRecord(liveBlock?.thumbnail)?.url) ||
      asString(liveBlock?.thumbnail) ||
      asString(asRecord(liveBlock?.thumbnail)?.src),
    subscriberCount: asNumber(row.subscription_count) || asNumber(row.subscriber_count),
    followersCount:
      asNumber(row.followers_count) || asNumber(row.follower_count) || asNumber(row.followersCount),
    channelId: asString(row.id) || (asNumber(row.id) != null ? String(asNumber(row.id)) : null),
    recentCategories,
    socials,
    playerEmbedUrl: `https://player.kick.com/${encodeURIComponent(slug)}`,
    channelUrl: `https://kick.com/${slug}`,
    source: 'kick-web-api',
  }
}

export function mergeKickChannels(
  official: KickChannelSnapshot | null,
  web: KickChannelSnapshot | null
): KickChannelSnapshot {
  if (!official && !web) throw new Error('Kick did not return channel data')
  if (!official) return web as KickChannelSnapshot
  if (!web) return official
  const isLive = official.isLive || web.isLive
  return {
    slug: official.slug || web.slug,
    displayName:
      web.displayName && web.displayName !== web.slug ? web.displayName : official.displayName || web.displayName,
    profileImageUrl: web.profileImageUrl || official.profileImageUrl,
    bannerUrl: isLive ? official.bannerUrl || web.bannerUrl : web.bannerUrl || official.bannerUrl,
    description: official.description.trim() || web.description,
    isLive,
    streamTitle: (isLive ? official.streamTitle || web.streamTitle : web.streamTitle || official.streamTitle) || null,
    category: official.category || web.category,
    viewerCount: isLive ? official.viewerCount ?? web.viewerCount : web.viewerCount,
    startedAt: isLive ? official.startedAt || web.startedAt : null,
    lastLiveAt: web.lastLiveAt || official.lastLiveAt,
    liveThumbnailUrl: official.liveThumbnailUrl || web.liveThumbnailUrl,
    subscriberCount: official.subscriberCount ?? web.subscriberCount,
    followersCount: web.followersCount ?? official.followersCount,
    channelId: web.channelId || official.channelId,
    recentCategories: web.recentCategories.length ? web.recentCategories : official.recentCategories,
    socials: web.socials.length ? web.socials : official.socials,
    playerEmbedUrl: official.playerEmbedUrl || web.playerEmbedUrl,
    channelUrl: official.channelUrl || web.channelUrl,
    source: 'kick-merged',
  }
}

export function mapClipCard(row: Record<string, unknown>, channelSlug: string): KickClipCard | null {
  const id = asString(row.id) || asString(row.clip_id) || asString(row.uuid)
  if (!id) return null
  const video =
    asString(row.video_url) ||
    asString(row.clip_url) ||
    asString(asRecord(row.video)?.url) ||
    asString(asRecord(row.video)?.full) ||
    asString(asRecord(row.source)?.url)
  const pageUrl =
    asString(row.clip_url) ||
    asString(row.url) ||
    `https://kick.com/${encodeURIComponent(channelSlug)}?clip=${encodeURIComponent(id)}`
  return {
    id,
    title: asString(row.title) || asString(row.clip_title) || 'Untitled clip',
    thumbnailUrl:
      asString(row.thumbnail_url) ||
      asString(asRecord(row.thumbnail)?.url) ||
      asString(row.thumbnail) ||
      asString(asRecord(row.thumbnails)?.medium),
    clipUrl: pageUrl,
    videoUrl: video,
    createdAt: asString(row.created_at) || asString(row.started_at) || asString(row.published_at),
    durationSeconds: asNumber(row.duration) || asNumber(row.duration_seconds),
    views: asNumber(row.views) || asNumber(row.view_count) || asNumber(row.views_count),
  }
}

export function parseClipList(payload: unknown, channelSlug: string): KickClipCard[] {
  const root = asRecord(payload)
  const candidates: unknown[] = []
  if (Array.isArray(payload)) candidates.push(...payload)
  if (root) {
    for (const key of ['clips', 'data', 'items', 'results']) {
      const value = root[key]
      if (Array.isArray(value)) candidates.push(...value)
      const nested = asRecord(value)
      if (nested && Array.isArray(nested.clips)) candidates.push(...nested.clips)
      if (nested && Array.isArray(nested.data)) candidates.push(...nested.data)
    }
  }
  const out: KickClipCard[] = []
  const seen = new Set<string>()
  for (const item of candidates) {
    const rec = asRecord(item)
    if (!rec) continue
    const mapped = mapClipCard(rec, channelSlug)
    if (!mapped || seen.has(mapped.id)) continue
    seen.add(mapped.id)
    out.push(mapped)
  }
  return out
}

export { asRecord }
