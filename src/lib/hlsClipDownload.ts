export type HlsByteRange = { start: number; length: number }

export type HlsSegment = {
  url: string
  range?: HlsByteRange
}

export type HlsMediaPlaylist = {
  kind: 'media'
  map?: HlsSegment
  segments: HlsSegment[]
  encrypted: boolean
}

export type HlsMasterPlaylist = {
  kind: 'master'
  variants: Array<{ url: string; bandwidth: number; height: number }>
}

export type HlsPlaylist = HlsMediaPlaylist | HlsMasterPlaylist

function resolvePlaylistUrl(uri: string, playlistUrl: string): string {
  return new URL(uri, playlistUrl).href
}

function parseAttrList(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(raw))) {
    const key = match[1].toUpperCase()
    const value = match[2].startsWith('"') ? match[2].slice(1, -1) : match[2]
    out[key] = value
  }
  return out
}

function parseByteRange(raw: string, previous?: HlsByteRange): HlsByteRange {
  const [lengthRaw, offsetRaw] = raw.trim().split('@')
  const length = Number(lengthRaw)
  if (!Number.isFinite(length) || length <= 0) {
    throw new Error('Invalid HLS byte range.')
  }
  if (offsetRaw != null && offsetRaw !== '') {
    const start = Number(offsetRaw)
    if (!Number.isFinite(start) || start < 0) throw new Error('Invalid HLS byte range offset.')
    return { start, length }
  }
  if (!previous) return { start: 0, length }
  return { start: previous.start + previous.length, length }
}

function parseMapTag(raw: string, playlistUrl: string): HlsSegment {
  const attrs = parseAttrList(raw)
  const uri = attrs.URI
  if (!uri) throw new Error('HLS init segment is missing a URI.')
  const segment: HlsSegment = { url: resolvePlaylistUrl(uri, playlistUrl) }
  if (attrs.BYTERANGE) segment.range = parseByteRange(attrs.BYTERANGE)
  return segment
}

export function looksLikeHlsPlaylist(text: string): boolean {
  return text.trimStart().startsWith('#EXTM3U')
}

export function isHlsSource(url: string, contentType?: string | null, bodyText?: string): boolean {
  if (url.toLowerCase().includes('.m3u8')) return true
  const type = (contentType || '').toLowerCase()
  if (type.includes('mpegurl') || type.includes('m3u8')) return true
  return Boolean(bodyText && looksLikeHlsPlaylist(bodyText))
}

export function parseHlsPlaylist(text: string, playlistUrl: string): HlsPlaylist {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const variants: HlsMasterPlaylist['variants'] = []
  const segments: HlsSegment[] = []
  let map: HlsSegment | undefined
  let encrypted = false
  let pendingRange: string | null = null
  let pendingStreamInf: Record<string, string> | null = null
  let lastRangeByUrl = new Map<string, HlsByteRange>()

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      pendingStreamInf = parseAttrList(line.slice('#EXT-X-STREAM-INF:'.length))
      continue
    }
    if (line.startsWith('#EXT-X-KEY:')) {
      const method = (parseAttrList(line.slice('#EXT-X-KEY:'.length)).METHOD || '').toUpperCase()
      if (method && method !== 'NONE') encrypted = true
      continue
    }
    if (line.startsWith('#EXT-X-MAP:')) {
      map = parseMapTag(line.slice('#EXT-X-MAP:'.length), playlistUrl)
      if (map.range) lastRangeByUrl.set(map.url, map.range)
      continue
    }
    if (line.startsWith('#EXT-X-BYTERANGE:')) {
      pendingRange = line.slice('#EXT-X-BYTERANGE:'.length).trim()
      continue
    }
    if (line.startsWith('#')) continue

    const url = resolvePlaylistUrl(line, playlistUrl)
    if (pendingStreamInf) {
      const resolution = pendingStreamInf.RESOLUTION || ''
      const height = Number(resolution.split('x')[1] || '0')
      variants.push({
        url,
        bandwidth: Number(pendingStreamInf.BANDWIDTH || '0') || 0,
        height: Number.isFinite(height) ? height : 0,
      })
      pendingStreamInf = null
      continue
    }

    const segment: HlsSegment = { url }
    if (pendingRange) {
      segment.range = parseByteRange(pendingRange, lastRangeByUrl.get(url))
      lastRangeByUrl.set(url, segment.range)
      pendingRange = null
    }
    segments.push(segment)
  }

  if (variants.length) return { kind: 'master', variants }
  return { kind: 'media', map, segments, encrypted }
}

export function pickHlsVariant(variants: HlsMasterPlaylist['variants']): HlsMasterPlaylist['variants'][number] {
  if (!variants.length) throw new Error('HLS playlist has no video renditions.')
  const ranked = [...variants].sort((a, b) => {
    const aFit = a.height > 0 && a.height <= 720 ? 1 : 0
    const bFit = b.height > 0 && b.height <= 720 ? 1 : 0
    if (aFit !== bFit) return bFit - aFit
    return b.bandwidth - a.bandwidth
  })
  return ranked[0]
}

async function fetchHlsText(url: string, headers: Record<string, string>): Promise<string> {
  const response = await fetch(url, { headers, cache: 'no-store', redirect: 'follow' })
  if (!response.ok) throw new Error(`Could not download clip playlist (${response.status}).`)
  return response.text()
}

async function fetchHlsBytes(
  segment: HlsSegment,
  headers: Record<string, string>
): Promise<Buffer> {
  const reqHeaders = { ...headers }
  if (segment.range) {
    const end = segment.range.start + segment.range.length - 1
    reqHeaders.Range = `bytes=${segment.range.start}-${end}`
  }
  const response = await fetch(segment.url, { headers: reqHeaders, cache: 'no-store', redirect: 'follow' })
  if (!response.ok) throw new Error(`Could not download clip video (${response.status}).`)
  return Buffer.from(await response.arrayBuffer())
}

export async function downloadHlsClip(params: {
  playlistUrl: string
  playlistText?: string
  headers: Record<string, string>
  maxBytes: number
}): Promise<{ buffer: Buffer; mimeType: string }> {
  let playlistUrl = params.playlistUrl
  let text = params.playlistText ?? (await fetchHlsText(playlistUrl, params.headers))
  let parsed = parseHlsPlaylist(text, playlistUrl)

  if (parsed.kind === 'master') {
    const variant = pickHlsVariant(parsed.variants)
    playlistUrl = variant.url
    text = await fetchHlsText(playlistUrl, params.headers)
    parsed = parseHlsPlaylist(text, playlistUrl)
  }

  if (parsed.kind !== 'media') throw new Error('Could not read this clip playlist.')
  if (parsed.encrypted) {
    throw new Error('This clip is encrypted and cannot be analyzed.')
  }
  if (!parsed.segments.length) {
    throw new Error('This clip playlist has no video segments.')
  }

  const parts: HlsSegment[] = parsed.map ? [parsed.map, ...parsed.segments] : parsed.segments
  const chunks: Buffer[] = []
  let total = 0
  for (const part of parts) {
    const chunk = await fetchHlsBytes(part, params.headers)
    total += chunk.length
    if (total > params.maxBytes) throw new Error('File too large (max 250MB)')
    chunks.push(chunk)
  }

  if (total < 1024) throw new Error('Clip file was too small to analyze.')
  return {
    buffer: Buffer.concat(chunks, total),
    mimeType: parsed.map ? 'video/mp4' : 'video/mpeg',
  }
}
