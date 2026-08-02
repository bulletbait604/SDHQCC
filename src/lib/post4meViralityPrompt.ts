/** Post4Me virality + platform-native title/hashtag rules for Gemini prompts. */

import { isYouTubeClipPlatform } from '@/lib/clipAnalyzerMetadata'

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram Reels',
  'youtube-shorts': 'YouTube Shorts',
  'youtube-long': 'YouTube (long-form)',
  'facebook-reels': 'Facebook Reels',
}

/** Per-platform algorithm playbook — must NOT treat IG/TikTok/YT like Facebook. */
export function post4mePlatformPlaybook(platformId: string): string {
  switch (platformId) {
    case 'tiktok':
      return `
TIKTOK PLAYBOOK (2026 — different from Facebook):
- Audience: younger, interest-graph FYP; rewards completion rate, rewatches, comments speed.
- Caption: SHORT — under ~150 chars total before hashtags. Hook = entire first line.
- Tone: raw / conversational / POV. Avoid polished "brand" Facebook wording.
- Tags: 3–5 only (1 light discovery like #fyp max + niche + clip-specific). Do NOT copy Facebook's 3–5 share tags.
- Win condition: curiosity + replay loop. Score harshly if caption reads like FB ("share this with a friend").
- Cross-post truth: identical FB-winning clips often underperform on TikTok unless the hook/caption feels native.`
    case 'instagram':
      return `
INSTAGRAM REELS PLAYBOOK (2026 — different from Facebook):
- Audience: aesthetic + save/share culture; IG often suppresses near-identical Meta cross-posts that look FB-first.
- Caption: 2–4 short sentences. Hook in first 30–50 chars (above "more"). Soft CTA to save/comment (not "share to your story" spam).
- Tone: cleaner than TikTok, warmer than YouTube. Specific > vague aesthetic fluff.
- Tags: 3–5 niche/community tags (NOT 20–30). Over-tagging can hurt Reels reach.
- Win condition: saves + shares + watch time. Score down generic FB group-share language.
- Do NOT reuse the Facebook caption — rewrite hook, body, and tags for IG.`
    case 'youtube-shorts':
      return `
YOUTUBE SHORTS PLAYBOOK (2026 — different from Facebook):
- Audience: search + browse; title is a search/CTR asset, not a social caption.
- Title: keyword-forward curiosity (what + why). Description: 1–2 sentences with searchable phrases + CTA to subscribe/comment.
- Tags: plain keywords (no #) for Studio — search intent + niche + "shorts".
- Tone: clearer payoff / educational or "here's why" beats FB sharebait.
- Win condition: title CTR + average view duration. A FB-style caption pasted into the title scores low.
- Never invent a Facebook-style combined caption for YouTube.`
    case 'facebook-reels':
      return `
FACEBOOK REELS PLAYBOOK (2026):
- Audience: broader/older; social graph + shares/comments in feed & groups.
- Caption: clearer narrative + discuss/share CTA works well here (unlike TikTok's ultra-short style).
- Tags: 3–5 shareability / community tags — light touch.
- Win condition: shares + meaningful comments. FB often over-indexes views vs TikTok/IG/YT on the SAME file — that is normal, not a copy failure on other apps.
- Still write FB-native copy; do not assume the same score applies to other platforms.`
    case 'youtube-long':
      return `
YOUTUBE LONG-FORM PLAYBOOK:
- Title: search + CTR (60–70 chars). Description: value + keywords (no hashtag stuffing).
- Tags: 10–15 plain keywords / long-tails.
- Score for click + session time, not Reels share velocity.`
    default:
      return `Write platform-native copy. Do not copy Facebook Reels packaging onto other apps.`
  }
}

export function post4meViralityScoringBlock(platformId: string): string {
  const label = PLATFORM_LABELS[platformId] || platformId
  return `
VIRALITY OPTIMIZATION (mandatory — score ONLY for ${label}, 2026):
1. Watch the clip and identify: strongest hook moment, emotional trigger, curiosity gap, niche, and ${label}-native share/save/search potential.
2. Write copy engineered for THIS platform's ranking signals — not a recycled Facebook caption.
3. Self-score predicted performance 0–100 FOR ${label} ONLY. Do not inflate TikTok/IG/YouTube scores just because Facebook would crush with the same file.
4. Calibration: Facebook Reels often gets more views than identical TikTok/IG/Shorts posts. If the clip is "FB-native" (clear story, shareable punchline, older-demo humor), score TikTok/IG/Shorts more conservatively unless you rewrite hooks to be native.
5. Tags: follow ${label} tag rules below — wrong tag strategy tanks reach even with a great clip.
6. Return "viralityScore" (0–100) and "viralitySummary" (2–3 sentences: why it fits ${label}, one risk, one concrete tweak if score < 85).
7. TITLES ARE #1: exactly 3 scroll-stopping hooks in "titles[]", ordered best-first, each a DIFFERENT formula. Never reuse another platform's exact hook wording.`
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
- Hashtags inside title/hook lines
- Copy-pasting the same hook across TikTok, Instagram, Facebook, and YouTube`

  const formulas = `
REQUIRED — exactly 3 titles, each a DIFFERENT formula:
1. CURIOSITY GAP — withhold the outcome; name the stakes
2. BOLD CLAIM / CONTRARIAN — challenge assumptions
3. SPECIFIC MOMENT — anchor to what happens on screen
4. QUESTION — direct "you" question
5. EMOTION / REACTION — raw reaction tied to the clip

Each title MUST include at least ONE concrete detail from the clip. Write like a top ${label} creator.`

  const examples =
    platformId === 'tiktok'
      ? `
GOOD TikTok hooks:
- "pov: chat said it was impossible and then THIS 😭"
- "why does this 0:04 hit harder than the whole match"
- "tell me you heard that without telling me"

BAD: "Share this reel with a friend!" (that's Facebook)`
      : platformId === 'instagram'
        ? `
GOOD Instagram Reels hooks:
- "the detail everyone missed at 0:06 👀"
- "saving this for the next time someone says ___"
- "okay but the timing here is criminal"

BAD: ultra-short TikTok slang dump OR Facebook "tag someone who..." only`
        : platformId === 'facebook-reels'
          ? `
GOOD Facebook Reels hooks:
- "I showed this to my group chat and nobody believed it"
- "The exact moment everything went sideways…"
- "Would you have done the same thing here?"

BAD: TikTok-only POV slang with no clear story`
          : isYouTube
            ? `
GOOD YouTube title examples:
- "He Hit This Line ONCE and the Whole Lobby Reset 🤯"
- "I Tested the Worst Build in the Game (It Worked?)"
- "This 3-Second Clip Explains Why Everyone Quit"

BAD: "Epic Gaming Moment" / Facebook sharebait with no keywords`
            : `
GOOD ${label} hooks — clip-specific, native tone.
BAD: bland generic hype or another platform's exact caption.`

  return `${banned}\n${formulas}\n${examples}`
}

export function post4meTitleEmojiRules(platformId: string): string {
  switch (platformId) {
    case 'tiktok':
      return `Hook (caption line 1): max ~70 chars. 0–2 emojis max. NO hashtags in the hook (tags[] only). Keep the whole caption punchy.`
    case 'instagram':
      return `Hook (first line): front-load in first 40 chars before "more". 1–2 tasteful emojis. NO hashtags in title (tags[] only). Body can be slightly longer than TikTok.`
    case 'facebook-reels':
      return `Hook: clear story tease in first line. 1–2 emojis OK. Body may include a light discuss/share CTA. NO hashtags in title.`
    case 'youtube-shorts':
      return `Titles: 30–60 chars, keyword-forward. 0–2 emojis max. NO hashtags in title. Description is separate — searchable, not a social caption.`
    case 'youtube-long':
      return `Titles: 60–70 chars max. Keyword in first 30 chars. 0–1 emoji. NO hashtags in title.`
    default:
      return `Title/hook: curiosity-driven, platform-native.`
  }
}

export function post4meMetadataPromptBlock(platformId: string): string {
  const titleRules = post4meTitleEmojiRules(platformId)
  const isYouTube = isYouTubeClipPlatform(platformId)
  const playbook = post4mePlatformPlaybook(platformId)

  if (isYouTube) {
    return `
${playbook}
YOUTUBE METADATA (strict — separate fields):
- "titles": EXACTLY 3 options ordered by predicted virality (highest first). ${titleRules}
${post4meTitleHooksBlock(platformId)}
- "description": keywords + CTA only. Do NOT include hashtags or title text. 1–3 sentences max for Shorts.
- "tags": plain keyword strings WITHOUT # (YouTube Studio paste format).
Never combine title, description, and tags into one field.`
  }

  const bodyRule =
    platformId === 'tiktok'
      ? `"description": 1 short line of context/CTA WITHOUT hashtags — total caption (title+description) should stay under ~150 characters before tags.`
      : platformId === 'instagram'
        ? `"description": 2–4 short sentences WITHOUT hashtags — value + soft save/comment CTA. Do not repeat the hook.`
        : `"description": caption body WITHOUT hashtags — clear context + light discuss/share CTA. Do not repeat the hook.`

  return `
${playbook}
CAPTION METADATA (strict — separate fields for generation):
- "titles": EXACTLY 3 scroll-stopping hook lines (best first). ${titleRules}
${post4meTitleHooksBlock(platformId)}
- ${bodyRule}
- "tags": hashtag strings WITH # prefix — follow ${PLATFORM_LABELS[platformId] || platformId} tag rules.
Do NOT put hashtags inside description or title. Do NOT reuse another platform's exact caption.`
}

/** Combined rules when generating metadata for multiple platforms in one response. */
export function post4meMultiPlatformRulesBlock(platformIds: string[]): string {
  const crossPost = `
CROSS-POST CALIBRATION (critical):
Creators often see Facebook Reels >> TikTok / Instagram / YouTube Shorts on the SAME video file and thumbnail.
That does NOT mean other platforms "failed" the video — audiences and ranking signals differ.
For EACH non-Facebook platform you MUST:
- Rewrite hooks/captions/tags natively (never clone the Facebook caption)
- Score that platform independently (usually lower than Facebook is OK and honest)
- In viralitySummary, name one platform-specific change that would lift reach (hook style, caption length, tags, CTA)`

  return (
    crossPost +
    '\n' +
    platformIds
      .map((id) => {
        const label = PLATFORM_LABELS[id] || id
        return `
--- ${label} (${id}) ---
${post4meViralityScoringBlock(id)}
${post4meMetadataPromptBlock(id)}
Tag rules: ${post4meTagViralityRules(id)}`
      })
      .join('\n')
  )
}

export function post4meTagViralityRules(platformId: string): string {
  switch (platformId) {
    case 'tiktok':
      return 'Tags: 3–5 total. At most ONE of #fyp/#foryou/#viral. Rest = niche + clip-specific. No 10+ tag spam.'
    case 'instagram':
      return 'Tags: 3–5 niche/community tags for Reels. Do NOT dump 20–30 hashtags — that pattern is outdated and can hurt reach.'
    case 'facebook-reels':
      return 'Tags: 3–5 relevant shareability / community tags. Prefer discussable topics over generic #viral spam.'
    case 'youtube-shorts':
      return 'Tags: 8–12 plain keywords (no #). Include niche + search-intent phrases + a shorts cue. Title/description carry more weight than tags.'
    case 'youtube-long':
      return 'Tags: 10–15 plain keywords (no #). Long-tail search phrases + topic clusters.'
    default:
      return 'Tags: platform-native mix of niche discovery terms — keep counts tight.'
  }
}

/** Recommended tag count for Post4Me specifically (Reels-era, not legacy IG 30-tag dumps). */
export function post4meRecommendedTagCount(platformId: string): number {
  switch (platformId) {
    case 'tiktok':
      return 5
    case 'instagram':
      return 5
    case 'facebook-reels':
      return 5
    case 'youtube-shorts':
      return 12
    case 'youtube-long':
      return 15
    default:
      return 8
  }
}
