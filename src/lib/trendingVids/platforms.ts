export type TrendingVidsPlatformId =
  | 'tiktok'
  | 'youtube'
  | 'instagram'
  | 'facebook'
  | 'reddit'
  | 'twitter'

export type TrendingVidsKind = 'video' | 'topic' | 'hashtag' | 'sound' | 'post'

/** Video-first platforms should prefer named videos when search names them. */
export type TrendingVidsSurface = 'video' | 'social'

export type TrendingVidsPlatform = {
  id: TrendingVidsPlatformId
  name: string
  surface: TrendingVidsSurface
  hint: string
  searchHint: string
}

export const TRENDING_VIDS_PLATFORMS: TrendingVidsPlatform[] = [
  {
    id: 'tiktok',
    name: 'TikTok',
    surface: 'video',
    hint: 'Sounds, hashtags, and viral video formats',
    searchHint:
      'Prefer named trending videos, sounds, and hashtags from TikTok Creative Center / trending pages. If a named clip is not in search results, list the sound, hashtag, or format as a topic.',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    surface: 'video',
    hint: 'Trending videos and topics (Shorts + long-form)',
    searchHint:
      'Prefer YouTube Trending / viral videos with title + channel. Mix Shorts and long-form. If a named video is not in search results, list the trending topic instead.',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    surface: 'video',
    hint: 'Reels trends, sounds, and formats',
    searchHint:
      'Prefer trending Instagram Reels, sounds, and formats. Name creators when search results include them.',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    surface: 'video',
    hint: 'Reels and Watch trends',
    searchHint:
      'Prefer trending Facebook Reels / Watch videos or formats. Name pages or creators when search results include them.',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    surface: 'social',
    hint: 'Trending posts, subreddits, and discussion topics',
    searchHint:
      'Prefer trending Reddit posts, subreddits, or discussion topics. Include the subreddit when known.',
  },
  {
    id: 'twitter',
    name: 'X / Twitter',
    surface: 'social',
    hint: 'Trending hashtags, topics, and viral posts',
    searchHint:
      'Prefer X/Twitter trending topics, hashtags, and viral posts. Name accounts when search results include them.',
  },
]

export function getTrendingVidsPlatform(
  id: string
): TrendingVidsPlatform | undefined {
  return TRENDING_VIDS_PLATFORMS.find((p) => p.id === id)
}

export function isTrendingVidsPlatformId(id: string): id is TrendingVidsPlatformId {
  return TRENDING_VIDS_PLATFORMS.some((p) => p.id === id)
}

export const TREND_KINDS: readonly TrendingVidsKind[] = [
  'video',
  'topic',
  'hashtag',
  'sound',
  'post',
]

export function isTrendingVidsKind(value: string): value is TrendingVidsKind {
  return (TREND_KINDS as readonly string[]).includes(value)
}
