/**
 * Shared prompt for tag generation (Gemini direct vs Fal OpenRouter).
 */

export function buildTagGeneratorPrompt(description: string, platform: string, count: number): string {
  const platformContext: Record<string, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    'youtube-shorts': 'YouTube Shorts',
    'youtube-long': 'YouTube',
    'facebook-reels': 'Facebook Reels',
  }

  const platformName = platformContext[platform.toLowerCase()] || platform

  return `Act as a Social Media SEO Specialist and Algorithm Researcher.

CONTEXT:
I am creating content for ${platformName}.
DESCRIPTION: "${description}"

TASK:
1. Briefly analyze the current ${platformName} algorithm trends for April 2026 (focusing on "Social Search" and SEO).
2. Identify the core "High-Intent Keywords" from my description that users would actually type into a search bar.
3. Generate ${count} optimized hashtags based on the platform strategy below.

PLATFORM STRATEGY:
${platformName === 'TikTok' ? '- Focus on discovery and relevance. Mix 2-3 broad trending tags (fyp, foryou, viral) with 3-5 niche-specific tags. Total 5-8 tags maximum.' : ''}${platformName === 'Instagram' ? '- Focus on "Relevance" over "Volume." Use 3-5 highly targeted hashtags combining community + aesthetic + niche.' : ''}${platformName === 'YouTube Shorts' || platformName === 'YouTube' ? '- Focus on "Searchable" tags. Use SEO-focused keywords that users actually search for.' : ''}${platformName === 'Facebook Reels' ? '- Focus on community and trending. Use broader appeal tags with some niche-specific ones.' : ''}

CONSTRAINTS:
- Generate exactly ${count} hashtags
- All lowercase, no # symbols
- Mix high-reach and niche tags (don't overstuff trending tags)
- Use underscores_for_multi_word_tags
- Focus on keywords users actually search for

Return ONLY a valid JSON array of strings:
["tag1", "tag2", "tag3", ...]`
}
