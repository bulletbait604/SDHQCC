/**
 * Shared prompt for tag generation (Gemini direct vs Fal OpenRouter).
 */

import { isYouTubeClipPlatform } from '@/lib/clipAnalyzerMetadata'

export function buildTagGeneratorPrompt(description: string, platform: string, count: number): string {
  const platformContext: Record<string, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    'youtube-shorts': 'YouTube Shorts',
    'youtube-long': 'YouTube',
    'facebook-reels': 'Facebook Reels',
  }

  const platformId = platform.toLowerCase()
  const platformName = platformContext[platformId] || platform
  const youtube = isYouTubeClipPlatform(platformId)

  const youtubeStrategy =
    '- Focus on searchable YouTube Studio tags (SEO keywords people type in Search). Multi-word phrases with SPACES (e.g. "minecraft survival", "fortnite highlights"). These are pasted into YouTube Studio as comma-separated tags — never hashtags.'
  const tiktokStrategy =
    '- Focus on discovery and relevance. Mix 2-3 broad trending tags (fyp, foryou, viral) with 3-5 niche-specific tags. Total 5-8 tags maximum.'
  const instagramStrategy =
    '- Focus on "Relevance" over "Volume." Use 3-5 highly targeted hashtags combining community + aesthetic + niche.'
  const facebookStrategy =
    '- Focus on community and trending. Use broader appeal tags with some niche-specific ones.'

  const strategy =
    platformName === 'TikTok'
      ? tiktokStrategy
      : platformName === 'Instagram'
        ? instagramStrategy
        : youtube
          ? youtubeStrategy
          : platformName === 'Facebook Reels'
            ? facebookStrategy
            : ''

  const constraints = youtube
    ? `- Generate exactly ${count} tags
- All lowercase, NO # symbols
- Multi-word tags MUST use spaces (never underscores)
- Mix high-reach and niche search keywords
- Each tag should look like a YouTube Studio tag field entry (plain keywords)`
    : `- Generate exactly ${count} hashtags
- All lowercase, no # symbols
- Mix high-reach and niche tags (don't overstuff trending tags)
- Use underscores_for_multi_word_tags
- Focus on keywords users actually search for`

  return `Act as a Social Media SEO Specialist and Algorithm Researcher.

CONTEXT:
I am creating content for ${platformName}.
DESCRIPTION: "${description}"

TASK:
1. Briefly analyze the current ${platformName} algorithm trends for April 2026 (focusing on "Social Search" and SEO).
2. Identify the core "High-Intent Keywords" from my description that users would actually type into a search bar.
3. Generate ${count} optimized ${youtube ? 'YouTube Studio tags' : 'hashtags'} based on the platform strategy below.

PLATFORM STRATEGY:
${strategy}

CONSTRAINTS:
${constraints}

Return ONLY a valid JSON array of strings:
${youtube ? '["gaming", "minecraft survival", "shorts", ...]' : '["tag1", "tag2", "tag3", ...]'}`
}
