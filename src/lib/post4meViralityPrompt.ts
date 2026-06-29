/** Post4Me virality + platform-native title/hashtag rules for Gemini prompts. */

import { isYouTubeClipPlatform } from '@/lib/clipAnalyzerMetadata'

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  'youtube-shorts': 'YouTube Shorts',
  'youtube-long': 'YouTube (long-form)',
  'facebook-reels': 'Facebook Reels',
}

export function post4meViralityScoringBlock(platformId: string): string {
  const label = PLATFORM_LABELS[platformId] || platformId
  return `
VIRALITY OPTIMIZATION (mandatory — optimize for ${label} discovery in 2026):
1. Watch the clip and identify: strongest hook moment, emotional trigger, curiosity gap, niche, and share/save potential.
2. Write copy engineered for HIGH completion rate, CTR, and algorithmic test-batch expansion — not generic descriptions.
3. Self-score predicted viral performance 0–100 before finalizing. Target 80+ on your primary recommendation.
4. Tags: mix platform-trending + niche + content-specific + broad discovery tags (see tag count rules). Prioritize tags the ${label} algorithm actually indexes.
5. Return "viralityScore" (0–100 integer) for your best primary option and "viralitySummary" (2 sentences: why it will perform + one risk to watch).
6. For "titles" array, order options highest virality first; each option should use a different hook formula (question, bold claim, benefit, curiosity gap).`
}

export function post4meTitleEmojiRules(platformId: string): string {
  switch (platformId) {
    case 'tiktok':
      return `Title/hook (caption line 1): max ~60 chars visible. Use 1–2 strategic emojis (🔥 ✨ 😱 💯 ❓) at the start or end IF they boost scroll-stop — never clutter. NO hashtags in the title line (hashtags go in tags[] only).`
    case 'instagram':
    case 'facebook-reels':
      return `Title/hook (caption line 1): front-load the hook in first 30 chars. Use 1–2 relevant emojis when they increase saves/shares — avoid emoji spam. NO hashtags in title (tags[] only).`
    case 'youtube-shorts':
      return `Titles: 30–60 chars, keyword-forward hook. YouTube Shorts CTR rewards 1–2 subtle emojis at the beginning OR end (e.g. 🤯 🔥) when they fit the niche — never more than 2. NO hashtags in title field.`
    case 'youtube-long':
      return `Titles: 60–70 chars max. Primary keyword in first 30 chars. Use 0–1 emoji only if it genuinely lifts CTR for this niche; prefer power words over emoji. NO hashtags in title.`
    default:
      return `Title/hook: curiosity-driven, platform-native. Use emojis only if this platform's algorithm rewards them for this niche.`
  }
}

export function post4meMetadataPromptBlock(platformId: string): string {
  const titleRules = post4meTitleEmojiRules(platformId)
  const isYouTube = isYouTubeClipPlatform(platformId)

  if (isYouTube) {
    return `
YOUTUBE METADATA (strict — separate fields):
- "titles": array of 3 options ordered by predicted virality (highest first). ${titleRules}
- "description": keywords + CTA only. Do NOT include hashtags or title text.
- "tags": plain keyword strings WITHOUT # (YouTube Studio paste format). Include high-intent search terms + niche + broad discovery terms.
Never combine title, description, and tags into one field.`
  }

  return `
CAPTION METADATA (strict — separate fields for generation):
- "titles": array with 1–3 hook lines (best/highest virality first). ${titleRules}
- "description": caption body WITHOUT hashtags (value, CTA, context).
- "tags": hashtag strings WITH # prefix — trending + niche + content-specific for ${PLATFORM_LABELS[platformId] || platformId}.
Do NOT put hashtags inside description or title.`
}

export function post4meTagViralityRules(platformId: string): string {
  switch (platformId) {
    case 'tiktok':
      return 'Tags: 5–8 total. Blend #fyp/#foryou (1–2 max) + niche + content tags. Favor tags with active momentum, not dead tags.'
    case 'instagram':
      return 'Tags: mix broad reach + niche community tags + 1–2 trending if relevant. Optimize for Reels tab + search.'
    case 'facebook-reels':
      return 'Tags: 3–5 relevant hashtags; prioritize shareability and local/niche community tags over generic spam.'
    case 'youtube-shorts':
      return 'Tags: 8–15 plain keywords (no #). Include "shorts" variants + niche + search-intent long-tails the algorithm matches.'
    case 'youtube-long':
      return 'Tags: 10–15 plain keywords (no #). Long-tail search phrases + series/topic clusters + competitor-adjacent terms.'
    default:
      return 'Tags: platform-native mix of trending and niche discovery terms.'
  }
}
