/** Clip Analyzer post metadata helpers — platform-specific title/description/tags. */

export function isYouTubeClipPlatform(platformId: string): boolean {
  const p = platformId.trim().toLowerCase()
  return (
    p === 'youtube' ||
    p === 'youtube-shorts' ||
    p === 'youtube-long' ||
    p === 'shorts'
  )
}

export function normalizeYouTubeTag(tag: string): string {
  return tag
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** YouTube Studio tags field: comma-separated, no # symbols. */
export function formatYouTubeTagsForCopy(tags: string[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const t = normalizeYouTubeTag(raw)
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out.join(', ')
}

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === 'string')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[,|\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

/** Remove hashtag tokens and trailing hashtag blocks from description copy. */
export function stripHashtagsFromDescription(text: string): string {
  let out = text.replace(/<[^>]*>/g, '').trim()
  // Drop trailing lines that are mostly hashtags
  const lines = out.split(/\n/)
  while (lines.length > 0) {
    const last = lines[lines.length - 1]?.trim() ?? ''
    const hashCount = (last.match(/#/g) || []).length
    if (hashCount >= 2 || /^#\w/.test(last)) {
      lines.pop()
      continue
    }
    break
  }
  out = lines.join('\n').trim()
  // Remove inline hashtag runs at end of paragraph
  out = out.replace(/(?:\s+#\w[\w-]*){2,}\s*$/g, '').trim()
  return out
}

function cleanYouTubeTitle(title: string): string {
  return title
    .replace(/<[^>]*>/g, '')
    .replace(/^#+\s*/, '')
    .replace(/\s+#+\s*$/, '')
    .trim()
}

export type NormalizedClipMetadata = {
  titles: string[]
  title?: string
  description: string
  tags: string[]
}

export function normalizeClipAnalysisMetadata(
  platformId: string,
  raw: {
    title?: unknown
    titles?: unknown
    description?: unknown
    tags?: unknown
  }
): NormalizedClipMetadata {
  if (!isYouTubeClipPlatform(platformId)) {
    const tags = coerceStringArray(raw.tags).map((t) =>
      t.startsWith('#') ? t : `#${t.replace(/^#+/, '')}`
    )
    const titles = coerceStringArray(raw.titles)
    const title =
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim()
        : titles[0]
    const description =
      typeof raw.description === 'string' ? raw.description.replace(/<[^>]*>/g, '').trim() : ''
    return {
      titles: titles.length ? titles : title ? [title] : [],
      title,
      description,
      tags,
    }
  }

  let titles = coerceStringArray(raw.titles).map(cleanYouTubeTitle)
  const singleTitle =
    typeof raw.title === 'string' && raw.title.trim()
      ? cleanYouTubeTitle(raw.title)
      : ''
  if (singleTitle && !titles.includes(singleTitle)) {
    titles = [singleTitle, ...titles]
  }
  titles = Array.from(new Set(titles.filter(Boolean))).slice(0, 5)

  let description =
    typeof raw.description === 'string'
      ? stripHashtagsFromDescription(raw.description)
      : ''

  let tags = coerceStringArray(raw.tags).map(normalizeYouTubeTag).filter(Boolean)

  // If model stuffed hashtags only in description, recover them for tags
  if (tags.length < 3 && typeof raw.description === 'string') {
    const fromDesc: string[] = []
    const hashRe = /#([\w][\w-]*)/g
    let match: RegExpExecArray | null
    while ((match = hashRe.exec(raw.description)) !== null) {
      const normalized = normalizeYouTubeTag(match[1] ?? '')
      if (normalized) fromDesc.push(normalized)
    }
    if (fromDesc.length > 0) {
      tags = Array.from(new Set(tags.concat(fromDesc)))
      description = stripHashtagsFromDescription(raw.description)
    }
  }

  // Dedupe tags
  const seen = new Set<string>()
  tags = tags.filter((t) => {
    const key = t.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return {
    titles,
    title: titles[0],
    description,
    tags,
  }
}

export function youtubeShortsMetadataPromptBlock(): string {
  return `
YOUTUBE SHORTS METADATA (strict — separate fields):
- "titles": array of 3 plain title strings (max 70 chars each). NO hashtags, NO emojis required, NO description text.
- "description": ONE string for the video description only (keywords + CTA). Do NOT include hashtags or title text in description.
- "tags": array of plain keyword strings WITHOUT # symbols (e.g. "gaming", "minecraft survival", "shorts"). Minimum 8 tags. These are pasted comma-separated into YouTube Studio.
Never combine title, description, and tags into a single field.`
}
