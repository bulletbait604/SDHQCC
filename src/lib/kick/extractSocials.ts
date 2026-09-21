export type ExtractedSocial = {
  network: string
  username: string | null
  url: string
}

const HOST_NETWORK: Record<string, string> = {
  'twitter.com': 'X',
  'x.com': 'X',
  'instagram.com': 'Instagram',
  'www.instagram.com': 'Instagram',
  'youtube.com': 'YouTube',
  'www.youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'tiktok.com': 'TikTok',
  'www.tiktok.com': 'TikTok',
  'discord.gg': 'Discord',
  'discord.com': 'Discord',
  'twitch.tv': 'Twitch',
  'www.twitch.tv': 'Twitch',
  'facebook.com': 'Facebook',
  'www.facebook.com': 'Facebook',
  'kick.com': 'Kick',
  'www.kick.com': 'Kick',
  'linktr.ee': 'Linktree',
  'beacons.ai': 'Beacons',
  'carrd.co': 'Carrd',
  'onlyfans.com': 'OnlyFans',
  'throne.com': 'Throne',
  'ko-fi.com': 'Ko-fi',
  'patreon.com': 'Patreon',
}

const KICK_USER_SOCIALS: Array<{
  key: string
  network: string
  toUrl: (handle: string) => string
}> = [
  { key: 'instagram', network: 'Instagram', toUrl: (h) => `https://instagram.com/${stripAt(h)}` },
  { key: 'twitter', network: 'X', toUrl: (h) => `https://x.com/${stripAt(h)}` },
  { key: 'youtube', network: 'YouTube', toUrl: (h) => `https://youtube.com/${h.startsWith('@') ? h : `@${stripAt(h)}`}` },
  { key: 'discord', network: 'Discord', toUrl: (h) => `https://discord.gg/${stripAt(h)}` },
  { key: 'tiktok', network: 'TikTok', toUrl: (h) => `https://tiktok.com/@${stripAt(h)}` },
  { key: 'facebook', network: 'Facebook', toUrl: (h) => `https://facebook.com/${stripAt(h)}` },
]

const URL_RE = /https?:\/\/[^\s<>"'`)\]},]+/gi

function stripAt(value: string): string {
  return value.replace(/^@/, '').trim()
}

function stripTrailingPunct(url: string): string {
  return url.replace(/[).,;!?]+$/g, '')
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function usernameFromPath(url: string, network: string): string | null {
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (network === 'YouTube') {
      const handle = parts.find((p) => p.startsWith('@'))
      if (handle) return handle
      if (parts[0] === 'channel' || parts[0] === 'c' || parts[0] === 'user') return parts[1] || null
      return parts[0] || null
    }
    if (network === 'Discord') return parts[0] || parsed.hostname
    if (parts[0]?.startsWith('@')) return parts[0]
    return parts[0] || null
  } catch {
    return null
  }
}

function socialFromUrl(url: string): ExtractedSocial | null {
  const cleaned = stripTrailingPunct(url)
  const host = hostOf(cleaned)
  if (!host) return null
  const network =
    HOST_NETWORK[host] ||
    HOST_NETWORK[`www.${host}`] ||
    (host.endsWith('.carrd.co') ? 'Carrd' : host)
  return {
    network,
    username: usernameFromPath(cleaned, network),
    url: cleaned,
  }
}

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_RE) || []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of matches) {
    const url = stripTrailingPunct(raw)
    if (seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

export function extractSocialsFromText(text: string): ExtractedSocial[] {
  const urls = extractUrls(text)
  const seen = new Set<string>()
  const out: ExtractedSocial[] = []
  for (const url of urls) {
    const social = socialFromUrl(url)
    if (!social) continue
    const key = `${social.network}:${social.url}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(social)
  }
  return out.slice(0, 12)
}

/** Kick stores linked socials as usernames on user.*, not as URLs in the bio. */
export function extractSocialsFromKickUser(user: Record<string, unknown> | null | undefined): ExtractedSocial[] {
  if (!user) return []
  const out: ExtractedSocial[] = []
  for (const row of KICK_USER_SOCIALS) {
    const raw = user[row.key]
    if (typeof raw !== 'string' || !raw.trim()) continue
    const handle = raw.trim()
    const url = /^https?:\/\//i.test(handle) ? handle : row.toUrl(handle)
    out.push({
      network: row.network,
      username: /^https?:\/\//i.test(handle) ? usernameFromPath(handle, row.network) : handle,
      url,
    })
  }
  return out
}

export function extractSocialsFromKickLinks(links: unknown): ExtractedSocial[] {
  if (!Array.isArray(links)) return []
  const out: ExtractedSocial[] = []
  for (const item of links) {
    const rec = item && typeof item === 'object' ? (item as Record<string, unknown>) : null
    const url = typeof rec?.link === 'string' ? rec.link.trim() : ''
    if (!url) continue
    const social = socialFromUrl(url)
    if (social) out.push(social)
  }
  return out
}

export function mergeSocials(...groups: ExtractedSocial[][]): ExtractedSocial[] {
  const seenNetwork = new Set<string>()
  const seenUrl = new Set<string>()
  const out: ExtractedSocial[] = []
  for (const group of groups) {
    for (const social of group) {
      const urlKey = social.url.toLowerCase()
      if (seenUrl.has(urlKey)) continue
      const known = KICK_USER_SOCIALS.some((row) => row.network === social.network)
      if (known && seenNetwork.has(social.network)) continue
      seenUrl.add(urlKey)
      if (known) seenNetwork.add(social.network)
      out.push(social)
    }
  }
  return out.slice(0, 12)
}

export function isFetchableProfilePage(url: string): boolean {
  const host = hostOf(url)
  return (
    host === 'linktr.ee' ||
    host === 'beacons.ai' ||
    host.endsWith('.carrd.co') ||
    host === 'kick.com'
  )
}
