export type GoingLiveStreamingId =
  | 'kick'
  | 'twitch'
  | 'youtube'
  | 'facebook-gaming'
  | 'trovo'
  | 'rumble'
  | 'picarto'

export type GoingLiveSocialId =
  | 'reddit'
  | 'facebook'
  | 'twitter'
  | 'instagram'
  | 'tiktok'
  | 'discord'

export type GoingLiveToneId = 'funny' | 'professional' | 'sincere' | 'angry' | 'adult'

export type GoingLiveStreamingPlatform = {
  id: GoingLiveStreamingId
  name: string
  titleMaxChars: number
  liveUrl: (username: string) => string
}

export type GoingLiveSocialPlatform = {
  id: GoingLiveSocialId
  name: string
  copyHint: string
  maxChars: number | null
  poster: { width: number; height: number; label: string }
}

export type GoingLiveTone = {
  id: GoingLiveToneId
  name: string
  hint: string
}

export const GOING_LIVE_STREAMING: GoingLiveStreamingPlatform[] = [
  {
    id: 'kick',
    name: 'KICK',
    titleMaxChars: 140,
    liveUrl: (u) => `https://kick.com/${u}`,
  },
  {
    id: 'twitch',
    name: 'Twitch',
    titleMaxChars: 140,
    liveUrl: (u) => `https://twitch.tv/${u}`,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    titleMaxChars: 100,
    liveUrl: (u) => `https://youtube.com/@${u}`,
  },
  {
    id: 'facebook-gaming',
    name: 'Facebook Gaming',
    titleMaxChars: 255,
    liveUrl: (u) => `https://facebook.com/${u}`,
  },
  {
    id: 'trovo',
    name: 'Trovo',
    titleMaxChars: 140,
    liveUrl: (u) => `https://trovo.live/${u}`,
  },
  {
    id: 'rumble',
    name: 'Rumble',
    titleMaxChars: 100,
    liveUrl: (u) => `https://rumble.com/c/${u}`,
  },
  {
    id: 'picarto',
    name: 'Picarto',
    titleMaxChars: 100,
    liveUrl: (u) => `https://picarto.tv/${u}`,
  },
]

export const GOING_LIVE_SOCIAL: GoingLiveSocialPlatform[] = [
  {
    id: 'reddit',
    name: 'Reddit',
    copyHint: 'Post title + body. No hashtag spam.',
    maxChars: null,
    poster: { width: 1200, height: 675, label: 'Feed image 1200×675' },
  },
  {
    id: 'facebook',
    name: 'Facebook',
    copyHint: 'Longer caption with a clear live link.',
    maxChars: null,
    poster: { width: 1200, height: 630, label: 'Feed image 1200×630' },
  },
  {
    id: 'twitter',
    name: 'X / Twitter',
    copyHint: 'One tweet, max 280 characters.',
    maxChars: 280,
    poster: { width: 1200, height: 675, label: 'Post image 1200×675' },
  },
  {
    id: 'instagram',
    name: 'Instagram',
    copyHint: 'Caption + hashtags at the end.',
    maxChars: 2200,
    poster: { width: 1080, height: 1080, label: 'Square 1080×1080' },
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    copyHint: 'Short caption and a few hashtags.',
    maxChars: 2200,
    poster: { width: 1080, height: 1350, label: 'Portrait 1080×1350' },
  },
  {
    id: 'discord',
    name: 'Discord',
    copyHint: 'Server announcement. Do not ping @everyone.',
    maxChars: 2000,
    poster: { width: 1280, height: 720, label: 'Embed 1280×720' },
  },
]

export const GOING_LIVE_TONES: GoingLiveTone[] = [
  { id: 'funny', name: 'Funny', hint: 'Jokes, bits, chaotic energy' },
  { id: 'professional', name: 'Professional', hint: 'Clean, clear, creator-brand' },
  { id: 'sincere', name: 'Sincere', hint: 'Warm, genuine, inviting' },
  { id: 'angry', name: 'Angry', hint: 'Gremlin / roast energy — not hate' },
  {
    id: 'adult',
    name: 'Adult',
    hint: 'Spicy / sexy / risqué — suggestive, not explicit',
  },
]

export const MAX_GOING_LIVE_REFS = 4
export const MAX_STREAM_USERNAME_CHARS = 32
export const MAX_STREAM_TOPIC_CHARS = 200
export const MAX_SOCIAL_PLATFORMS = GOING_LIVE_SOCIAL.length

export function getGoingLiveStreaming(
  id: string
): GoingLiveStreamingPlatform | undefined {
  return GOING_LIVE_STREAMING.find((p) => p.id === id)
}

export function getGoingLiveSocial(id: string): GoingLiveSocialPlatform | undefined {
  return GOING_LIVE_SOCIAL.find((p) => p.id === id)
}

export function isGoingLiveStreamingId(id: string): id is GoingLiveStreamingId {
  return GOING_LIVE_STREAMING.some((p) => p.id === id)
}

export function isGoingLiveSocialId(id: string): id is GoingLiveSocialId {
  return GOING_LIVE_SOCIAL.some((p) => p.id === id)
}

export function isGoingLiveToneId(id: string): id is GoingLiveToneId {
  return GOING_LIVE_TONES.some((t) => t.id === id)
}

export function getGoingLiveTone(id: string): GoingLiveTone | undefined {
  return GOING_LIVE_TONES.find((t) => t.id === id)
}

export function normalizeStreamUsername(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/^@+/, '')
    .trim()
    .replace(/[^\w.-]/g, '')
    .slice(0, MAX_STREAM_USERNAME_CHARS)
}

export function normalizeSocialIds(raw: unknown): GoingLiveSocialId[] {
  const list = Array.isArray(raw) ? raw : []
  const seen = new Set<GoingLiveSocialId>()
  const out: GoingLiveSocialId[] = []
  for (const item of list) {
    if (typeof item !== 'string') continue
    const id = item.trim().toLowerCase()
    if (!isGoingLiveSocialId(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= MAX_SOCIAL_PLATFORMS) break
  }
  return out
}
