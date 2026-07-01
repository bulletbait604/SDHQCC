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
6. TITLES ARE THE #1 PRIORITY: provide exactly 3 scroll-stopping hook lines in "titles[]", ordered highest virality first. Each must use a DIFFERENT hook formula (see title hooks block). Never reuse the same angle twice.`
}

/** Aggressive anti-bland rules + hook formulas for titles / caption line 1. */
export function post4meTitleHooksBlock(platformId: string): string {
  const label = PLATFORM_LABELS[platformId] || platformId
  const isYouTube = platformId.startsWith('youtube')

  const banned = `
BANNED (never use — instant fail):
- Generic filler: "Check this out", "Amazing clip", "Watch till the end", "You need to see this", "Insane moment", "Epic gameplay", "So good", "Wait for it" (without specifics)
- Vague hype with NO clip detail: "This is crazy", "Unbelievable", "Mind-blowing" alone
- Summary titles that describe nothing: "Funny stream highlight", "Great play", "Best moment"
- Hashtags inside title/hook lines`

  const formulas = `
REQUIRED — exactly 3 titles, each a DIFFERENT formula:
1. CURIOSITY GAP — withhold the outcome; name the stakes ("I tried ___ and ___ happened", "Nobody expected ___")
2. BOLD CLAIM / CONTRARIAN — challenge assumptions ("This is why ___ is broken", "Stop doing ___ like this")
3. SPECIFIC MOMENT — anchor to what happens on screen (character name, move, number, quote, sound, plot twist from the clip)
4. QUESTION — direct "you" question that demands an answer ("Why does nobody talk about ___?", "Would you ___?")
5. EMOTION / REACTION — raw human reaction tied to the clip ("The exact second I lost it…", "POV: you just witnessed ___")

Each title MUST include at least ONE concrete detail from the clip (who/what/when/outcome). Write like a top ${label} creator, not a corporate social media manager.`

  const examples = isYouTube
    ? `
GOOD YouTube title examples (adapt to THIS clip):
- "He Hit This Line ONCE and the Whole Lobby Reset 🤯"
- "I Tested the Worst Build in the Game (It Worked?)"
- "This 3-Second Clip Explains Why Everyone Quit"

BAD examples (too bland):
- "Epic Gaming Moment"
- "Funny Clip You Have to Watch"
- "Amazing Highlight From My Stream"`
    : `
GOOD ${label} hook examples (adapt to THIS clip — emojis optional):
- "POV: you finally hit the line everyone said was impossible 🔥"
- "tell me why this sound made the whole chat lose it"
- "I wasn't ready for what happened at 0:07 😭"

BAD examples (too bland):
- "Check out this clip!"
- "Stream highlight #gaming"
- "Wait for the end 👀" (with no specific tease)`

  return `${banned}\n${formulas}\n${examples}`
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
- "titles": EXACTLY 3 options ordered by predicted virality (highest first). ${titleRules}
${post4meTitleHooksBlock(platformId)}
- "description": keywords + CTA only. Do NOT include hashtags or title text.
- "tags": plain keyword strings WITHOUT # (YouTube Studio paste format). Include high-intent search terms + niche + broad discovery terms.
Never combine title, description, and tags into one field.`
  }

  return `
CAPTION METADATA (strict — separate fields for generation):
- "titles": EXACTLY 3 scroll-stopping hook lines (best/highest virality first). ${titleRules}
${post4meTitleHooksBlock(platformId)}
- "description": caption body WITHOUT hashtags (value, CTA, context) — do NOT repeat the hook verbatim.
- "tags": hashtag strings WITH # prefix — trending + niche + content-specific for ${PLATFORM_LABELS[platformId] || platformId}.
Do NOT put hashtags inside description or title.`
}

/** Combined rules when generating metadata for multiple platforms in one response. */
export function post4meMultiPlatformRulesBlock(platformIds: string[]): string {
  return platformIds
    .map((id) => {
      const label = PLATFORM_LABELS[id] || id
      return `
--- ${label} (${id}) ---
${post4meViralityScoringBlock(id)}
${post4meMetadataPromptBlock(id)}
Tag rules: ${post4meTagViralityRules(id)}`
    })
    .join('\n')
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
