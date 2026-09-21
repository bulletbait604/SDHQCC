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

const URL_RE = /https?:\/\/[^\s<>"'`)\]},]+/gi

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
    const host = hostOf(url)
    const network =
      HOST_NETWORK[host] ||
      HOST_NETWORK[`www.${host}`] ||
      (host.endsWith('.carrd.co') ? 'Carrd' : host ? host : 'Link')
    const key = `${network}:${url}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      network,
      username: usernameFromPath(url, network),
      url,
    })
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
