import type { Platform } from '@/lib/home/types'
import { formatYouTubeTagsForCopy, isYouTubeClipPlatform } from '@/lib/clipAnalyzerMetadata'

export function getRecommendedTagCount(platformId: string, platforms: Platform[]): number {
  const platform = platforms.find((p) => p.id === platformId)
  if (!platform?.data?.descriptionTips) return 10

  const tips = platform.data.descriptionTips.toLowerCase()
  const rangeMatch = tips.match(/(\d+)[–-](\d+)\s*(hashtag|keyword|tag)/)
  if (rangeMatch) return parseInt(rangeMatch[2], 10)

  const upToMatch = tips.match(/up to (\d+)\s*(hashtag|keyword|tag)/)
  if (upToMatch) return parseInt(upToMatch[1], 10)

  const exactMatch = tips.match(/(\d+)\s*(hashtag|keyword|tag)/)
  if (exactMatch) return parseInt(exactMatch[1], 10)

  if (platformId === 'tiktok') return 8
  if (platformId === 'instagram') return 30
  if (platformId === 'youtube-shorts') return 15
  if (platformId === 'youtube-long' || platformId === 'youtube') return 15
  if (platformId === 'facebook-reels') return 5
  return 10
}

export function getEditSuggestionsTagSlice(
  platformId: string,
  tags: string[] | undefined,
  platforms: Platform[]
): string[] {
  const list = tags || []
  if (!list.length) return []
  const cap = Math.min(list.length, Math.max(8, getRecommendedTagCount(platformId, platforms)))
  return list.slice(0, cap)
}

/** Clean a model tag for the target platform (YouTube keeps spaces; others are hashtag slugs). */
export function sanitizeGeneratedTag(tag: string, platformId: string): string {
  const raw = String(tag).trim().replace(/^#+/, '')
  if (isYouTubeClipPlatform(platformId)) {
    return raw
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .trim()
      .toLowerCase()
  }
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '')
}

/** Clipboard string: YouTube Studio is comma-separated with no #; other apps are #hashtags. */
export function formatTagsForClipboard(platformId: string, tags: string[]): string {
  const cleaned = tags
    .map((t) => sanitizeGeneratedTag(t, platformId))
    .filter((t) => t.length > 2)
  if (isYouTubeClipPlatform(platformId)) {
    return formatYouTubeTagsForCopy(cleaned)
  }
  return cleaned.map((t) => `#${t}`).join(' ')
}
