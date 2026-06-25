import type { Platform } from '@/lib/home/types'

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
  if (platformId === 'youtube-shorts') return 5
  if (platformId === 'youtube-long' || platformId === 'youtube') return 10
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
