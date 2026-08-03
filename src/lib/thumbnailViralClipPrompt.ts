/**
 * Shared viral clip → thumbnail prompts (production Thumbnail Generator + Thumbnail 2.0).
 * Sticker-only overlays, algorithm-driven CTR, no invented faces/game assets.
 */

export function platformLabelForThumbnail(platformId: string): string {
  const labels: Record<string, string> = {
    'youtube-shorts': 'YouTube Shorts',
    'youtube-long': 'YouTube (long-form)',
    tiktok: 'TikTok',
    instagram: 'Instagram Reels',
    'facebook-reels': 'Facebook Reels',
    twitter: 'X (Twitter)',
    kick: 'Kick',
  }
  return labels[platformId] || platformId
}

export function isVerticalThumbnailPlatform(platformId: string): boolean {
  return ['youtube-shorts', 'tiktok', 'facebook-reels', 'instagram'].includes(platformId)
}

/** Default video model for clip analysis (2.5 Flash / Flash-Lite blocked for many new keys). */
export const THUMBNAIL_CLIP_VIDEO_MODEL_DEFAULT = 'gemini-3.1-flash-lite'

export function buildViralClipAnalyzePrompt(params: {
  platformId: string
  algoContext: string
  durationNote: string
}): string {
  const label = platformLabelForThumbnail(params.platformId)
  const vertical = isVerticalThumbnailPlatform(params.platformId)

  return `You are an elite viral thumbnail strategist for ${label}. Watch this reference clip.

Thumbnail format: ${vertical ? 'VERTICAL 9:16 (mobile short-form)' : 'Horizontal 16:9 click-magnet'}
${params.durationNote}

${params.algoContext}

ALGORITHM FIRST: Your frame choice, emotionalHook, onImageText, and viralThumbnailBrief MUST reflect the cached ${label} algorithm data above (especially hook/title patterns and visual retention signals). algorithmAlignment must cite 1–2 concrete lines from that snapshot — not generic advice.

FRAME SELECTION (pick ONE timestamp — a real screenshot will be extracted, so the emotion must already be in-frame):
Priority order — choose the highest that actually appears in the clip AND matches algorithm CTR patterns:
1) Clear human REACTION face of someone who is IN the clip (shock, fear, disbelief, rage, hype) — mouth/eyes readable
2) Intense clutch / danger peak with that same real person visible
3) On-screen warnings, alerts, death screens, red UI, big damage numbers already present
4) High-contrast action of existing subjects (never invent new people)

Hard bans for frame choice:
- Do NOT pick a bland idle / menu / walking / "lost wandering" frame if a stronger reaction or warning UI exists
- Prefer mid/late peaks over the first 10 seconds unless that is truly the best reaction
- The moment must create a curiosity gap a scroller would click — confuse/lost vibes alone are weak unless paired with danger or a readable face reaction
- subjectDescription must name only people/objects visibly in that frame

OVERLAY BRIEF RULES (viralThumbnailBrief — stickers ONLY, but LOUD):
- A zoomed screenshot + title alone is a FAIL. Brief must specify a full viral sticker pack:
  1) 1–2 huge outlined ALL-CAPS hooks
  2) at least ONE big emoji sticker matching the emotion (😱 😳 💀 🔥 😮 etc.)
  3) at least ONE thick arrow pointing at the face or danger UI
  4) at least ONE bright circle/oval around the key subject or warning
  5) optional: sparkles / bang / "!" badges / neon underlines
- Forbidden: inventing people, faces, stock cutouts, new enemies, NPCs, weapons, game props, environment changes
- If a reaction inset helps CTR, DUPLICATE/CROP the creator face from THIS frame only
- Keep the brief punchy (max ~100 words). No self-critique. No "I will regenerate" language.

Viral text rules:
- onImageText: exactly 2 SHORT punchy hooks (3–6 words each), ALL-CAPS, high-stakes / curiosity / specificity
- Pattern wording after cached title/hook tips — ban soft filler ("I'M SO LOST", "WATCH THIS") unless the peak literally is that joke
- No duplicate lines

Return bestMomentTimestamp as MM:SS or H:MM:SS.

Return valid JSON only (no markdown):
{
  "bestMomentTimestamp": "e.g. 1:12:34 or 12:34 or 0:45",
  "subjectDescription": "who/what is visibly in that frame (real clip subject only)",
  "emotionalHook": "the scroll-stopping feeling already visible in-frame",
  "onImageText": ["HOOK ONE", "HOOK TWO"],
  "colorPalette": "high-contrast viral colors + mood",
  "compositionNotes": "where BIG text + emoji + arrow + circle go for ${vertical ? '9:16' : '16:9'} without covering the face",
  "viralThumbnailBrief": "Loud sticker pack art direction (emoji+arrow+circle+Impact text) aligned to algorithm CTR (100 words max)",
  "algorithmAlignment": "Cite cached ${label} snapshot lines this thumb follows"
}`
}

/** Append to paint prompts when editing a real clip frame. */
export function viralClipPaintRulesBlock(params: {
  platformId: string
  algoContext: string
}): string {
  const label = platformLabelForThumbnail(params.platformId)
  return `${params.algoContext}

VIRAL CTR MANDATE: This must look like a top ${label} clickbait thumbnail — chaotic sticker energy, not a quiet cropped screenshot with a caption. Follow the cached algorithm data for hook style. Paint each onImageText hook exactly once (no duplicates).

REQUIRED STICKER PACK (all of these must appear — missing any is a fail):
A) HUGE Impact / YouTube-thumbnail text with thick black/white outline + drop shadow (mobile-readable from arm's length)
B) At least one LARGE emoji sticker (😱 😳 💀 🔥 😮 or closest match to the emotionalHook) near the subject
C) At least one thick bright arrow pointing at the face OR the danger/warning UI already in frame
D) At least one bright circle/oval around the key face or threat marker already in frame
E) Punchy grade: boost contrast/saturation, slight vignette OK — still keep the real scene recognizable

CRITICAL PAINT RULES (these OVERRIDE the viral brief and any creator overrides if they conflict):
1) The attached image is the ONLY source of people and scene content. Keep faces, bodies, enemies, UI, and environment recognizable — do not redraw or replace them.
2) OVERLAYS ONLY — pile on flat graphics (text, emoji stickers, arrows, circles, sparkles, bang/"!" badges). A title-only or zoom-only edit is NOT enough.
3) NEVER invent or paste a new person, random woman/man face, stock reaction face, influencer cutout, or any face not clearly taken from the attached frame.
4) If you add a reaction-face inset, it MUST be a crop/duplicate of a person already visible in THIS frame. Prefer circle+arrow on their existing face.
5) NEVER add new game characters, enemies, monsters, weapons, props, blood FX, or environment objects that are not already in the frame.
6) Do not restage the gameplay — no new threats, NPCs, or background swaps.
7) Keep big text high enough to clear platform UI chrome; do not bury the face under text.
8) OUTPUT IMAGE ONLY — no critiques, checklists, regeneration plans, or explanations.`
}
