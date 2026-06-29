import type { NormalizedClipMetadata } from '@/lib/clipAnalyzerMetadata'

/** TikTok / Instagram / Reels: single caption block with description + hashtags. */
export function buildCombinedPostCaption(meta: NormalizedClipMetadata): string {
  const title = (meta.title || meta.titles?.[0] || '').trim()
  const desc = meta.description.trim()
  const hashtagBlock = meta.tags
    .map((t) => (t.startsWith('#') ? t : `#${t.replace(/^#+/, '')}`))
    .join(' ')

  const parts: string[] = []
  if (title) parts.push(title)
  if (desc) parts.push(desc)
  if (hashtagBlock) parts.push(hashtagBlock)
  return parts.join('\n\n').trim()
}
