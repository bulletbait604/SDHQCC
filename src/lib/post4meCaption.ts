import type { NormalizedClipMetadata } from '@/lib/clipAnalyzerMetadata'

/**
 * Build a single paste-ready caption for TikTok / Instagram / Facebook Reels.
 * Layout differs by platform so FB-length captions aren't dumped onto TikTok.
 */
export function buildCombinedPostCaption(
  meta: NormalizedClipMetadata,
  platformId?: string
): string {
  const title = (meta.title || meta.titles?.[0] || '').trim()
  const desc = meta.description.trim()
  const tags = meta.tags
    .map((t) => (t.startsWith('#') ? t : `#${t.replace(/^#+/, '')}`))
    .filter(Boolean)

  // Keep TikTok tight; IG/FB can carry a bit more body before tags.
  const maxTags =
    platformId === 'tiktok' ? 5 : platformId === 'instagram' ? 5 : platformId === 'facebook-reels' ? 5 : 8
  const hashtagBlock = tags.slice(0, maxTags).join(' ')

  if (platformId === 'tiktok') {
    // Prefer hook + optional one-liner + tags — avoid long FB essays.
    const body = desc && desc !== title ? desc : ''
    const shortBody =
      body.length > 120 ? `${body.slice(0, 117).trimEnd()}…` : body
    return [title, shortBody, hashtagBlock].filter(Boolean).join('\n\n').trim()
  }

  if (platformId === 'instagram') {
    return [title, desc, hashtagBlock].filter(Boolean).join('\n\n').trim()
  }

  // Facebook Reels — narrative + discuss CTA style is fine
  return [title, desc, hashtagBlock].filter(Boolean).join('\n\n').trim()
}
