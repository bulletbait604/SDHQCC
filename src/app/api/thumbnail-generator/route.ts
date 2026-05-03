import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fal } from "@fal-ai/client";
import { GoogleGenAI } from "@google/genai";
import { v4 as uuidv4 } from "uuid";
import {
  deleteFileFromR2,
  generatePresignedReadUrl,
} from "@/lib/r2";

/** Same stack as `src/app/api/tags/route.ts` — Flash is cheap and fast for short rewrite. */
const THUMBNAIL_GEMINI_MODEL_DEFAULT = "gemini-2.5-flash";

function thumbnailGeminiModelId(): string {
  return (
    process.env.THUMBNAIL_GEMINI_MODEL?.trim() || THUMBNAIL_GEMINI_MODEL_DEFAULT
  );
}

/** When true and `GEMINI_API` is set, rewrite creator notes via Gemini before Schnell. */
function thumbnailGeminiEnrichEnabled(): boolean {
  const v = process.env.THUMBNAIL_GEMINI_ENRICH?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

/**
 * Text-to-image defaults:
 * - **FLUX.2 Turbo** (`fal-ai/flux-2/turbo`) — newer stack, stronger prompt adherence than FLUX.1 Schnell;
 *   supports Fal’s built-in `enable_prompt_expansion`.
 * - Override with `FAL_THUMBNAIL_TXT2IMG_MODEL=fal-ai/flux-1/schnell` for legacy ultra-fast FLUX.1 Schnell (4-step).
 *
 * Image remix / Redux stays FLUX.1 Schnell Redux (`fal-ai/flux-1/schnell/redux`).
 *
 * **Image + prompt:** default `fal-ai/flux-2/turbo/edit` (same FLUX.2 Turbo family as T2I).
 * Override with `FAL_THUMBNAIL_IMG2IMG_MODEL=fal-ai/flux/dev/image-to-image` for FLUX.1 dev i2i.
 *
 * **Nano Banana (Fal):** `fal-ai/nano-banana` + `fal-ai/nano-banana/edit` (Gemini 2.5 Flash Image)
 * use `aspect_ratio`, not FLUX `image_size`. **Nano Banana Pro** (`fal-ai/nano-banana-pro` / `.../edit`)
 * adds `resolution` (1K/2K/4K) and optional `enable_web_search`. Enable the whole stack with
 * `FAL_THUMBNAIL_IMAGE_STACK=nano_banana_pro` (overridable per-role with `FAL_THUMBNAIL_TXT2IMG_MODEL` / `FAL_THUMBNAIL_IMG2IMG_MODEL`).
 */
const FAL_DEFAULT_TXT2IMG_SMART = "fal-ai/flux-2/turbo";
const FAL_LIVE_FLUX1_SCHNELL_REDUX = "fal-ai/flux-1/schnell/redux";
const FAL_DEFAULT_IMG2IMG_FLUX2_EDIT = "fal-ai/flux-2/turbo/edit";

const FAL_NANO_PRO_T2I = "fal-ai/nano-banana-pro";
const FAL_NANO_PRO_EDIT = "fal-ai/nano-banana-pro/edit";
const FAL_NANO_FLASH_T2I = "fal-ai/nano-banana";
const FAL_NANO_FLASH_EDIT = "fal-ai/nano-banana/edit";

/** Preset backends; explicit `FAL_THUMBNAIL_TXT2IMG_MODEL` / `IMG2IMG` wins over stack. */
type ThumbnailImageStack = "flux" | "nano_banana_pro";

function thumbnailImageStack(): ThumbnailImageStack {
  const v = process.env.FAL_THUMBNAIL_IMAGE_STACK?.trim().toLowerCase();
  if (
    v === "nano_banana_pro" ||
    v === "nano-banana-pro" ||
    v === "pro" ||
    v === "smart_nano"
  ) {
    return "nano_banana_pro";
  }
  return "flux";
}

/**
 * Keep text-only vs reference paths on the **same nano family**: if env sets only img2img
 * (`…/nano-banana/edit` or Pro), default T2I to the paired endpoint so “no upload” flows
 * don’t silently stay on FLUX.
 */
function falNanoBananaT2iFromImg2imgExplicit(img2imgId: string): string | null {
  const id = img2imgId.trim();
  if (id === FAL_NANO_PRO_EDIT || id.startsWith(`${FAL_NANO_PRO_EDIT}/`)) {
    return FAL_NANO_PRO_T2I;
  }
  if (id === FAL_NANO_FLASH_EDIT || id.startsWith(`${FAL_NANO_FLASH_EDIT}/`)) {
    return FAL_NANO_FLASH_T2I;
  }
  return null;
}

function falNanoBananaEditFromTxtExplicit(txtId: string): string | null {
  const id = txtId.trim();
  if (id === FAL_NANO_PRO_T2I || id.startsWith(`${FAL_NANO_PRO_T2I}/`)) {
    return FAL_NANO_PRO_EDIT;
  }
  if (id === FAL_NANO_FLASH_T2I || id.startsWith(`${FAL_NANO_FLASH_T2I}/`)) {
    return FAL_NANO_FLASH_EDIT;
  }
  return null;
}

function falTxt2imgModelId(): string {
  const o = process.env.FAL_THUMBNAIL_TXT2IMG_MODEL?.trim();
  if (o) return o;
  const img2explicit = process.env.FAL_THUMBNAIL_IMG2IMG_MODEL?.trim();
  const paired =
    img2explicit && falNanoBananaT2iFromImg2imgExplicit(img2explicit);
  if (paired) return paired;
  if (thumbnailImageStack() === "nano_banana_pro") return FAL_NANO_PRO_T2I;
  return FAL_DEFAULT_TXT2IMG_SMART;
}

/** FLUX.2 Turbo t2i — different OpenAPI shape than FLUX.1 Schnell (no `num_inference_steps`). */
function isFlux2TurboTxt2Img(modelId: string): boolean {
  const id = modelId.trim();
  return id === "fal-ai/flux-2/turbo" || id.startsWith("fal-ai/flux-2/turbo/");
}

/** Fal’s optional in-model prompt expansion (FLUX.2 Turbo). Default on for better topic fidelity. */
function thumbnailFlux2PromptExpansionEnabled(): boolean {
  const v = process.env.FAL_THUMBNAIL_FLUX2_PROMPT_EXPANSION?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  return true;
}

function thumbnailFlux2GuidanceScale(): number {
  const raw = process.env.FAL_THUMBNAIL_FLUX2_GUIDANCE_SCALE ?? "2.5";
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n)) return 2.5;
  return Math.min(20, Math.max(0, n));
}

function falImg2imgModelId(): string {
  const o = process.env.FAL_THUMBNAIL_IMG2IMG_MODEL?.trim();
  if (o) return o;
  const txtExplicit = process.env.FAL_THUMBNAIL_TXT2IMG_MODEL?.trim();
  const paired =
    txtExplicit && falNanoBananaEditFromTxtExplicit(txtExplicit);
  if (paired) return paired;
  if (thumbnailImageStack() === "nano_banana_pro") return FAL_NANO_PRO_EDIT;
  return FAL_DEFAULT_IMG2IMG_FLUX2_EDIT;
}

/** Gemini Flash Image on Fal (`fal-ai/nano-banana` family). */
function isNanoBananaFlashT2iModel(modelId: string): boolean {
  return modelId.trim() === FAL_NANO_FLASH_T2I;
}

function isNanoBananaFlashEditModel(modelId: string): boolean {
  const id = modelId.trim();
  return id === FAL_NANO_FLASH_EDIT;
}

/** Nano Banana Pro — Gemini 3 Pro Image on Fal ([docs](https://fal.ai/models/fal-ai/nano-banana-pro/api)). */
function isNanoBananaProT2iModel(modelId: string): boolean {
  return modelId.trim() === FAL_NANO_PRO_T2I;
}

function isNanoBananaProEditModel(modelId: string): boolean {
  return modelId.trim() === FAL_NANO_PRO_EDIT;
}

function isFalNanoBananaT2iModel(modelId: string): boolean {
  return (
    isNanoBananaFlashT2iModel(modelId) || isNanoBananaProT2iModel(modelId)
  );
}

function isFalNanoBananaEditModel(modelId: string): boolean {
  return (
    isNanoBananaFlashEditModel(modelId) || isNanoBananaProEditModel(modelId)
  );
}

/**
 * Nano Banana endpoints take `aspect_ratio` enums (not FLUX presets). Mirrors the branching in
 * `falImageSizeFromPlatforms`: 16:9 YouTube/twitter, 9:16 shorts, 4:5 Instagram-only feed.
 */
function nanoBananaAspectRatioFromPlatforms(
  platforms: string[] | undefined
): string {
  const ids = Array.isArray(platforms) ? platforms : [];
  const wantsPortrait =
    ids.some((id) =>
      ["youtube-shorts", "tiktok", "facebook-reels"].includes(id)
    ) && !ids.some((id) => id === "youtube-long");
  const wantsInstagram = ids.includes("instagram");
  const wantsLandscape =
    ids.includes("youtube-long") ||
    ids.includes("twitter") ||
    (!wantsPortrait && !wantsInstagram && ids.length > 0);

  if (wantsInstagram && !wantsPortrait && !ids.includes("youtube-long")) {
    return "4:5";
  }
  if (wantsPortrait || (wantsInstagram && !wantsLandscape)) {
    return "9:16";
  }
  return "16:9";
}

function falNanoBananaProResolution(): "1K" | "2K" | "4K" {
  const raw =
    process.env.FAL_THUMBNAIL_NANO_PRO_RESOLUTION?.trim().toUpperCase() ?? "1K";
  if (raw === "2K" || raw === "4K" || raw === "1K") return raw;
  return "1K";
}

/** Shared Fal Nano Banana API fields (Flash + Pro). Pro adds resolution + optional web search. */
function nanoBananaBaseInput(params: {
  aspectRatio: string;
  includeProResolution: boolean;
}): Record<string, unknown> {
  const tolRaw = process.env.FAL_THUMBNAIL_NANO_SAFETY_TOLERANCE?.trim();
  const tol =
    tolRaw && /^[1-6]$/.test(tolRaw) ? tolRaw : "4";
  const out: Record<string, unknown> = {
    num_images: 1,
    output_format: "png",
    aspect_ratio: params.aspectRatio,
    safety_tolerance: tol,
  };
  if (params.includeProResolution) {
    out.resolution = falNanoBananaProResolution();
    const ws =
      process.env.FAL_THUMBNAIL_NANO_PRO_WEB_SEARCH?.trim().toLowerCase();
    if (ws === "1" || ws === "true" || ws === "yes") {
      out.enable_web_search = true;
    }
  }
  return out;
}

/** FLUX.2 Turbo **edit** — `image_urls` + `prompt`; bills input+output MP per Fal. */
function isFlux2TurboEditModel(modelId: string): boolean {
  const id = modelId.trim();
  return (
    id === "fal-ai/flux-2/turbo/edit" ||
    id.startsWith("fal-ai/flux-2/turbo/edit/")
  );
}

/** Schnell Redux / legacy flux path — same API shape, no `prompt` input. */
function isFluxSchnellReduxModel(modelId: string): boolean {
  return (
    modelId === FAL_LIVE_FLUX1_SCHNELL_REDUX ||
    modelId === "fal-ai/flux/schnell/redux"
  );
}

/** Clamped 0.01–1.0; lower = stay closer to the source image. */
function thumbnailImg2imgStrength(): number {
  const raw = process.env.FAL_THUMBNAIL_IMG2IMG_STRENGTH ?? "0.65";
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n)) return 0.65;
  return Math.min(1, Math.max(0.01, n));
}

/**
 * `fal-ai/flux/dev/image-to-image` allows 10–50 steps (default here 28). For a 4-step
 * Schnell-style endpoint, set FAL_THUMBNAIL_IMG2IMG_STEPS=4 when that model ID exists.
 */
function thumbnailImg2imgSteps(): number {
  const raw = process.env.FAL_THUMBNAIL_IMG2IMG_STEPS ?? "28";
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return 28;
  return Math.min(50, Math.max(1, n));
}

/** `fal-ai/flux-1/schnell/redux` allows 1–12 steps (default 4). */
function thumbnailSchnellReduxSteps(): number {
  const raw = process.env.FAL_THUMBNAIL_SCHNELL_REDUX_STEPS ?? "4";
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return 4;
  return Math.min(12, Math.max(1, n));
}

function falApiKey(): string | undefined {
  const k =
    process.env.SCHNELL_API_KEY?.trim() ||
    process.env.FAL_KEY?.trim() ||
    process.env.FAL_API_KEY?.trim();
  return k || undefined;
}

function configureFal(): void {
  const key = falApiKey();
  if (!key) {
    throw new Error(
      "Fal API key required for thumbnails: set SCHNELL_API_KEY or FAL_KEY"
    );
  }
  fal.config({ credentials: key });
}

/** Aspect / pixel hints per platform (vertical shorts vs horizontal vs Instagram) */
function thumbnailSpecFromPlatforms(platforms: string[] | undefined): {
  label: string;
  pixels: string;
  aspectNote: string;
} {
  const ids = Array.isArray(platforms) ? platforms : [];
  const wantsPortrait =
    ids.some((id) =>
      ["youtube-shorts", "tiktok", "facebook-reels"].includes(id)
    ) && !ids.some((id) => id === "youtube-long");
  const wantsInstagram = ids.includes("instagram");
  const wantsLandscape =
    ids.includes("youtube-long") ||
    ids.includes("twitter") ||
    (!wantsPortrait && !wantsInstagram && ids.length > 0);

  if (wantsInstagram && !wantsPortrait && !ids.includes("youtube-long")) {
    return {
      label: "Instagram",
      pixels: "1080×1350 pixels (4:5 portrait feed)",
      aspectNote:
        "Portrait 4:5 ratio optimized for Instagram feed; safe margins for UI overlays.",
    };
  }
  if (wantsInstagram && wantsLandscape) {
    return {
      label: "Mixed / Instagram + horizontal",
      pixels: "1280×720 pixels (16:9)",
      aspectNote:
        "16:9 landscape; strong focal subject centered for cross-posting.",
    };
  }
  if (wantsPortrait || (wantsInstagram && !wantsLandscape)) {
    return {
      label: "Vertical (9:16)",
      pixels: "1080×1920 pixels (9:16)",
      aspectNote:
        "Full vertical 9:16 for TikTok, YouTube Shorts, Facebook Reels; leave headroom for mobile UI.",
    };
  }
  if (wantsLandscape) {
    return {
      label: "Horizontal (16:9)",
      pixels: "1280×720 pixels (16:9)",
      aspectNote:
        "Classic widescreen YouTube thumbnail; bold readable title zones.",
    };
  }
  return {
    label: "Horizontal (16:9)",
    pixels: "1280×720 pixels (16:9)",
    aspectNote: "Balanced 16:9 thumbnail composition.",
  };
}

type FalImageSize =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9"
  | { width: number; height: number };

function falImageSizeFromPlatforms(platforms: string[] | undefined): FalImageSize {
  const ids = Array.isArray(platforms) ? platforms : [];
  const wantsPortrait =
    ids.some((id) =>
      ["youtube-shorts", "tiktok", "facebook-reels"].includes(id)
    ) && !ids.some((id) => id === "youtube-long");
  const wantsInstagram = ids.includes("instagram");
  const wantsLandscape =
    ids.includes("youtube-long") ||
    ids.includes("twitter") ||
    (!wantsPortrait && !wantsInstagram && ids.length > 0);

  if (wantsInstagram && !wantsPortrait && !ids.includes("youtube-long")) {
    return { width: 1080, height: 1350 };
  }
  if (wantsPortrait || (wantsInstagram && !wantsLandscape)) {
    return "portrait_16_9";
  }
  return "landscape_16_9";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Light domain detection so Schnell gets concrete visual cues when the user names
 * games, stream platforms, or social apps—no extra model round-trip.
 */
const DOMAIN_HINT_RULES: ReadonlyArray<{
  phrases: readonly string[];
  words: readonly string[];
  hint: string;
}> = [
  {
    phrases: [
      "video game",
      "videogame",
      "gaming",
      "gameplay",
      "esports",
      "e-sports",
      "speedrun",
      "let's play",
      "lets play",
      "walkthrough",
      "multiplayer",
      "single player",
      "open world",
      "battle royale",
      "steam deck",
      "epic games",
      "playstation",
      "xbox",
      "nintendo",
      "switch game",
      "game server",
      "fps game",
      "mmorpg",
      "roguelike",
      "indie game",
      "playing ",
      "game called",
      "new game",
      "game update",
      "game patch",
      "boss fight",
      "jrpg",
      "gacha",
      "soulslike",
    ],
    words: [
      "gamer",
      "gaming",
      "fortnite",
      "minecraft",
      "valorant",
      "roblox",
      "steam",
      "rpg",
      "fps",
      "mmo",
      "cod",
      "zelda",
      "mario",
      "pokemon",
      "genshin",
      "honkai",
      "windrose",
      "warframe",
      "destiny",
      "overwatch",
      "apex",
      "lol",
      "dota",
    ],
    hint:
      "Gaming subject: lean into game-culture visuals—dynamic motion, saturated contrast, arena or HUD-adjacent energy; if the text names a specific game or franchise, match that title's genre, palette, and mood (fantasy, sci-fi, anime RPG, etc.) using original stylized scenes—do not reproduce official logos or copyrighted character designs.",
  },
  {
    phrases: [
      "live stream",
      "livestream",
      "streaming",
      "streamer",
      "going live",
      "broadcast",
      "face cam",
      "facecam",
      "vtuber",
      "youtube live",
      "facebook gaming",
      "on twitch",
      "twitch stream",
      "twitch.tv",
      "kick stream",
      "live on",
    ],
    words: ["twitch", "kick", "subathon", "raid", "trovo", "multistream"],
    hint:
      "Live streaming / broadcast: design like a click-to-watch stream thumbnail—not a silent movie poster. **Render large headline text inside the artwork** (outlined/stroked glowing type, comic-youtube style): primary line SHOULD include something like **LIVE ON TWITCH**, **STREAMING TODAY**, **LIVE NOW**, or phrase the creator used; add a witty subtitle if tone allows (tie to game/theme e.g. pirate joke for Windrose). Twitch mentions: Twitch-vibe palette (**purple/black**, neon edge glow), HUD or lower-third energy, tiny chat-bubble motifs optional. Use an **original abstract** purple “stream glitch” emblem shape—invented geometry, **not** an exact pixel copy of Twitch’s trademark logo.",
  },
  {
    phrases: [
      "social media",
      "short form",
      "short-form",
      "shorts",
      "reels",
      "feed post",
      "story highlight",
      "link in bio",
    ],
    words: [
      "instagram",
      "tiktok",
      "youtube",
      "twitter",
      "threads",
      "snapchat",
      "linkedin",
      "reddit",
      "discord",
      "bluesky",
      "mastodon",
      "facebook",
      "pinterest",
    ],
    hint:
      "Social platform context: if the text names a platform (Instagram, TikTok, X, etc.), mirror that surface's typical thumbnail shape—**paint bold headline + hook text inside the artwork** with sticker energy; bold focal point legible at small preview; invent generic glyphs only (no official app icons/logos).",
  },
  {
    phrases: [
      "movie",
      "film",
      "tv show",
      "television",
      "series finale",
      "anime",
      "documentary",
    ],
    words: ["netflix", "hulu", "disney+", "hbo", "crunchyroll", "spotify", "podcast"],
    hint:
      "Entertainment / AV subject: cinematic lighting and composition where appropriate; readable title-safe areas and mood that matches film, series, or audio-show tone from the text.",
  },
];

function domainHintsForPrompt(userText: string): string {
  const lower = userText.toLowerCase();
  const lines: string[] = [];

  for (const rule of DOMAIN_HINT_RULES) {
    let matched = rule.phrases.some((p) => lower.includes(p));
    if (!matched) {
      for (const w of rule.words) {
        const re = new RegExp(`\\b${escapeRegExp(w.toLowerCase())}\\b`, "i");
        if (re.test(userText)) {
          matched = true;
          break;
        }
      }
    }
    if (matched) {
      lines.push(rule.hint);
    }
  }

  if (lines.length === 0) {
    return "";
  }

  const unique = Array.from(new Set(lines));
  return `\n\nSubject hints (use only what matches the instructions; stay safe and generic where no brand assets are provided):\n${unique.map((l) => `• ${l}`).join("\n")}`;
}

/** Extra cue when creator clearly wants a stream platform thumb with on-image lettering. */
function streamThumbnailTypographyBlock(userText: string): string {
  const lower = userText.toLowerCase();
  const twitchy =
    /\btwitch\b/i.test(userText) || lower.includes("twitch.tv");
  const streaming =
    twitchy ||
    /\bstreaming\b|\bstreamer\b|\blive stream\b|\bgoing live\b|\blive on\b|\bstream today\b|\bon stream\b/i.test(
      userText
    );

  if (!streaming) {
    return "";
  }

  const twitchExtra = twitchy
    ? ` Include Twitch-readability: invented purple glitch-icon graphic + words **TWITCH** or **LIVE ON TWITCH** spelled clearly in chunky display type (readable at small preview).`
    : "";

  return `\n\n**Must-have layout:** Busy streamer thumbnail—not a lone illustration. Overlay **multiple text layers**: big primary headline + smaller caption line (humor ok).${twitchExtra} Text must be drawn as part of the image composition, high contrast outlines.`;
}

/**
 * Extra layout pressure from selected surfaces (works even when the creator never typed
 * "streaming" / "YouTube")—Gemini-image models often default to clean posters without this.
 */
function platformOverlayHintsFromPlatforms(platforms: string[] | undefined): string {
  const ids = Array.isArray(platforms) ? platforms : [];
  if (ids.length === 0) return "";

  const bits: string[] = [];
  if (ids.includes("youtube-long")) {
    bits.push(
      "YouTube-wide expectations: **huge outlined headline** (yellow/white/red stroke OK), optional **arrows, circles, shock lines** as flat graphic stickers; busy magazine-cutout energy unless instructions say minimal."
    );
  }
  if (
    ids.some((id) =>
      ["youtube-shorts", "tiktok", "facebook-reels", "instagram"].includes(id)
    )
  ) {
    bits.push(
      "Short-form / vertical feed: **hook line + subline** stacked or split; punchy color pop; **badge / burst / emoji-shaped decals** (original shapes) hugging the subject."
    );
  }
  if (bits.length === 0) return "";
  return `\n\n**Selected platforms (${ids.join(", ")}):**\n${bits.map((b) => `• ${b}`).join("\n")}`;
}

/** Universal contract so models don't return plain illustrations with empty "title safe" zones. */
const THUMBNAIL_GRAPHIC_OVERLAY_CONTRACT =
  "\n\n**Mandatory graphic thumbnail treatment:** The final image must include **real painted typography**—at least a **dominant headline** plus a **second text line** (subtitle, stat, or callout)—with **thick stroke, hard shadow, or outer glow** so it reads at tiny preview size. Add **collage-style graphic layers**: arrows, starbursts, simple badges, sparkles, or emoji-like doodles as **flat stickers** around the focal subject. Phrases should echo the instructions (or invent short hooks if none given). **Invented / generic marks only**—do not copy official brand logos, game marks, or trademarked UI; stylized originals are required.";

function buildPromptText(
  instructionText: string,
  spec: ReturnType<typeof thumbnailSpecFromPlatforms>,
  hasImage: boolean,
  /** Original user text for keyword/domain hints (when Gemini rewrites `instructionText`). */
  domainKeywordSource?: string,
  /** Echo creator wording when an LLM rewrote instructions—keeps proper nouns (games, platforms). */
  literalAnchorSource?: string,
  platforms?: string[]
): string {
  const domain = domainHintsForPrompt(domainKeywordSource ?? instructionText);
  const keywordSource = domainKeywordSource ?? instructionText;
  const streamBlock = streamThumbnailTypographyBlock(keywordSource);
  const platformOverlay = platformOverlayHintsFromPlatforms(platforms);

  const fidelity =
    literalAnchorSource &&
    literalAnchorSource.trim() !== instructionText.trim()
      ? `\n\nCreator anchors (these phrases MUST shape mood, setting, composition, and any on-image titles): ${literalAnchorSource.trim()}`
      : "";

  const obeyLiteral =
    "\n\nPriority: The creator's topic comes first—avoid unrelated generic stock scenes. For stream/social thumbs, **spell out platform names and hooks as bold graphic type in-frame** when they said Twitch etc.; use original stylized icons (no pixel-perfect trademark copies). Games/platforms still guide palette and mood.";

  return hasImage
    ? `You are a professional multi-platform thumbnail designer. An image is provided—compose around it and honor the text below.${obeyLiteral}

Instructions: ${instructionText}${fidelity}${domain}${streamBlock}${platformOverlay}${THUMBNAIL_GRAPHIC_OVERLAY_CONTRACT}

Output dimensions: ${spec.pixels} (${spec.label}). ${spec.aspectNote}
High contrast, bold colors, clear visual hierarchy—**all headline and sticker graphics must be fully rendered inside the image pixels** (never implied or left for post-production).`
    : `You are a professional multi-platform thumbnail designer.${obeyLiteral}

Instructions: ${instructionText}${fidelity}${domain}${streamBlock}${platformOverlay}${THUMBNAIL_GRAPHIC_OVERLAY_CONTRACT}

Output dimensions: ${spec.pixels} (${spec.label}). ${spec.aspectNote}
High contrast, bold colors, clear visual hierarchy—**all headline and sticker graphics must be fully rendered inside the image pixels** (never implied or left for post-production).`;
}

/**
 * Optional LLM pass: expand vague creator notes into concrete visual directions for FLUX.
 * Falls back silently so thumbnails still generate if Gemini errors or is disabled.
 */
async function enrichThumbnailBriefWithGemini(params: {
  userPrompt: string;
  platforms: string[] | undefined;
}): Promise<string | null> {
  const apiKey = process.env.GEMINI_API?.trim();
  if (!apiKey) {
    return null;
  }

  const platformLine =
    params.platforms && params.platforms.length > 0
      ? `Target surfaces (hints only): ${params.platforms.join(", ")}.`
      : "";

  const safeNotes = params.userPrompt.replace(/"""/g, '"');

  const metaPrompt = `You help draft image prompts for thumbnail image models (FLUX, Nano Banana / Gemini-image on Fal, etc.).

Rewrite the creator's notes into ONE concise paragraph (max 110 words) of concrete visual directions: subject, mood, lighting, palette, composition, plus **exact short strings** the model must **paint as on-image typography** (e.g. "LIVE ON TWITCH", "NEW GAME — WINDROSE", a funny one-liner)—not "space for text" or "add title later". Also name **2–4 graphic sticker elements** to include (arrow, starburst, badge shape, emoji doodle) so the frame looks like a real social thumbnail—not a clean movie poster.

CRITICAL—keep fidelity to what they wrote:
• If they name a streaming platform (Twitch, Kick, YouTube Live, etc.), prescribe **busy stream-thumb layout**: purple/black Twitch energy when relevant, chunky outlined lettering, HUD corners; propose exact short phrases for on-image typography.
• If they name a game, franchise, or title (e.g. indie games, RPGs, Windrose, etc.), translate it into matching genre art direction—fantasy forest vs sci-fi HUD vs anime RPG mood—even when you cannot show official logos or characters (describe original scenes "inspired by" that genre).
• Do NOT drop proper nouns that carry meaning; you may name platforms and games as *theme anchors*. Do not reproduce official logos, trademark UI, or real people's likenesses—stylized original imagery only.

${platformLine}

Creator notes:
"""
${safeNotes}
"""

Reply with plain prose only—no markdown, no bullets, no quotes wrapping the whole answer.`;

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.generateContent({
      model: thumbnailGeminiModelId(),
      contents: [{ role: "user", parts: [{ text: metaPrompt }] }],
    });

    let rawText: string;
    try {
      const r = response as unknown as {
        text?: string | (() => string);
      };
      rawText =
        typeof r.text === "function"
          ? r.text()
          : String(r.text ?? "");
    } catch {
      return null;
    }

    const cleaned = rawText.trim().replace(/^["'`]+|["'`]+$/g, "");
    if (!cleaned || cleaned.length < 12) {
      return null;
    }
    return cleaned;
  } catch (e) {
    console.warn("[Thumbnail] Gemini enrichment failed:", e);
    return null;
  }
}

async function fetchImageBufferFromUrl(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download generated image: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { buffer: buf, contentType };
}

/**
 * Upload reference bytes to R2 and pass a presigned HTTPS URL to Fal (same pattern as
 * `fal.queue.submit` docs with `image_url: "https://..."` — avoids huge `data:` bodies).
 * Falls back to `data:...;base64,...` if R2 staging is disabled or fails.
 */
async function stagingImageUrlForFal(params: {
  imageBase64: string;
  mimeType: string;
  sessionId: string | undefined;
}): Promise<{ imageUrl: string; stagingKey: string | null }> {
  if (process.env.FAL_THUMBNAIL_DISABLE_R2_SOURCE_STAGING === "1") {
    const mime = params.mimeType || "image/jpeg";
    return {
      imageUrl: `data:${mime};base64,${params.imageBase64}`,
      stagingKey: null,
    };
  }

  const bucket = process.env.R2_BUCKET_NAME;
  if (
    !bucket ||
    !process.env.R2_ACCOUNT_ID ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY
  ) {
    const mime = params.mimeType || "image/jpeg";
    return {
      imageUrl: `data:${mime};base64,${params.imageBase64}`,
      stagingKey: null,
    };
  }

  const mime = params.mimeType || "image/jpeg";
  const buf = Buffer.from(params.imageBase64, "base64");
  const ext =
    mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpeg";
  const stagingKey = `thumbnails/${params.sessionId || uuidv4()}/fal-source-${uuidv4()}.${ext}`;

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: stagingKey,
        Body: buf,
        ContentType: mime,
      })
    );
  } catch (e) {
    console.warn("[Thumbnail] R2 source staging failed, using data URI:", e);
    return {
      imageUrl: `data:${mime};base64,${params.imageBase64}`,
      stagingKey: null,
    };
  }

  const ttlRaw = process.env.FAL_THUMBNAIL_SOURCE_READ_URL_SEC ?? "7200";
  const ttl = Number.parseInt(ttlRaw, 10);
  const expiresIn = Number.isNaN(ttl)
    ? 7200
    : Math.min(86400, Math.max(300, ttl));

  const readUrl = await generatePresignedReadUrl(stagingKey, expiresIn);
  if (!readUrl) {
    await deleteFileFromR2(stagingKey).catch(() => {});
    return {
      imageUrl: `data:${mime};base64,${params.imageBase64}`,
      stagingKey: null,
    };
  }

  return { imageUrl: readUrl, stagingKey };
}

type ThumbnailGenResult = {
  key: string;
  imageBase64: string;
  mimeType: string;
  description: string;
  falModel: string;
};

async function generateThumbnailSchnell(params: {
  prompt: string;
  imageBase64: string | null;
  mimeType: string;
  platforms: string[] | undefined;
  sessionId: string | undefined;
}): Promise<ThumbnailGenResult> {
  configureFal();

  const maxPromptLength = 500;
  const truncatedPrompt =
    params.prompt.length > maxPromptLength
      ? params.prompt.slice(0, maxPromptLength) + "..."
      : params.prompt;

  let instructionPrompt = truncatedPrompt;
  if (thumbnailGeminiEnrichEnabled()) {
    const enriched = await enrichThumbnailBriefWithGemini({
      userPrompt: truncatedPrompt,
      platforms: params.platforms,
    });
    if (enriched) {
      instructionPrompt =
        enriched.length > maxPromptLength
          ? enriched.slice(0, maxPromptLength) + "..."
          : enriched;
    }
  }

  const spec = thumbnailSpecFromPlatforms(params.platforms);
  const promptText = buildPromptText(
    instructionPrompt,
    spec,
    !!params.imageBase64,
    truncatedPrompt,
    instructionPrompt.trim() !== truncatedPrompt.trim()
      ? truncatedPrompt
      : undefined,
    params.platforms
  );
  const imageSize = falImageSizeFromPlatforms(params.platforms);
  const nanoAspect = nanoBananaAspectRatioFromPlatforms(params.platforms);

  let imageUrlForDownload: string;
  let description: string;
  let falModel: string;

  if (params.imageBase64) {
    const img2imgModel = falImg2imgModelId();
    let falSourceStagingKey: string | null = null;

    try {
      const staged = await stagingImageUrlForFal({
        imageBase64: params.imageBase64,
        mimeType: params.mimeType,
        sessionId: params.sessionId,
      });
      falSourceStagingKey = staged.stagingKey;
      const imageUrlForFal = staged.imageUrl;

      const result = isFluxSchnellReduxModel(img2imgModel)
        ? await fal.subscribe(img2imgModel, {
            input: {
              image_url: imageUrlForFal,
              image_size: imageSize,
              num_inference_steps: thumbnailSchnellReduxSteps(),
              num_images: 1,
              enable_safety_checker: true,
              output_format: "png",
              acceleration: "regular",
            },
            logs: false,
          })
        : isFalNanoBananaEditModel(img2imgModel)
          ? await fal.subscribe(img2imgModel, {
              input: {
                ...nanoBananaBaseInput({
                  aspectRatio: nanoAspect,
                  includeProResolution: isNanoBananaProEditModel(img2imgModel),
                }),
                prompt: promptText,
                image_urls: [imageUrlForFal],
              },
              logs: false,
            })
          : isFlux2TurboEditModel(img2imgModel)
            ? await fal.subscribe(img2imgModel, {
                input: {
                  prompt: promptText,
                  image_urls: [imageUrlForFal],
                  image_size: imageSize,
                  guidance_scale: thumbnailFlux2GuidanceScale(),
                  num_images: 1,
                  enable_prompt_expansion: thumbnailFlux2PromptExpansionEnabled(),
                  enable_safety_checker: true,
                  output_format: "png",
                },
                logs: false,
              })
            : await fal.subscribe(img2imgModel, {
                input: {
                  image_url: imageUrlForFal,
                  prompt: promptText,
                  strength: thumbnailImg2imgStrength(),
                  num_inference_steps: thumbnailImg2imgSteps(),
                  guidance_scale: 3.5,
                  num_images: 1,
                  enable_safety_checker: true,
                  output_format: "png",
                  acceleration: "regular",
                },
                logs: false,
              });

      const data = result.data as {
        images?: Array<{ url: string }>;
        prompt?: string;
        description?: string;
      };
      const first = data.images?.[0]?.url;
      if (!first) {
        throw new Error("Fal image-to-image did not return an image URL");
      }
      imageUrlForDownload = first;
      falModel = img2imgModel;
      description =
        data.description?.trim() ||
        data.prompt ||
        (isFluxSchnellReduxModel(img2imgModel)
          ? "FLUX.1 Schnell Redux (image remix)."
          : isFalNanoBananaEditModel(img2imgModel)
            ? isNanoBananaProEditModel(img2imgModel)
              ? "Nano Banana Pro edit (reference + prompt)."
              : "Nano Banana edit (reference + prompt)."
            : isFlux2TurboEditModel(img2imgModel)
              ? "FLUX.2 Turbo edit (reference + prompt)."
              : "FLUX image-to-image (reference + prompt).");
    } finally {
      if (falSourceStagingKey) {
        await deleteFileFromR2(falSourceStagingKey).catch(() => {});
      }
    }
  } else {
    const txtModel = falTxt2imgModelId();

    const result = isFalNanoBananaT2iModel(txtModel)
      ? await fal.subscribe(txtModel, {
          input: {
            ...nanoBananaBaseInput({
              aspectRatio: nanoAspect,
              includeProResolution: isNanoBananaProT2iModel(txtModel),
            }),
            prompt: promptText,
          },
          logs: false,
        })
      : isFlux2TurboTxt2Img(txtModel)
        ? await fal.subscribe(txtModel, {
            input: {
              prompt: promptText,
              image_size: imageSize,
              guidance_scale: thumbnailFlux2GuidanceScale(),
              num_images: 1,
              enable_prompt_expansion: thumbnailFlux2PromptExpansionEnabled(),
              enable_safety_checker: true,
              output_format: "png",
            },
            logs: false,
          })
        : await fal.subscribe(txtModel, {
            input: {
              prompt: promptText,
              image_size: imageSize,
              num_inference_steps: 4,
              guidance_scale: 3.5,
              num_images: 1,
              enable_safety_checker: true,
              output_format: "png",
              acceleration: "regular",
            },
            logs: false,
          });

    const data = result.data as {
      images?: Array<{ url: string }>;
      prompt?: string;
      description?: string;
    };
    const first = data.images?.[0]?.url;
    if (!first) {
      throw new Error("Fal text-to-image did not return an image URL");
    }
    imageUrlForDownload = first;
    falModel = txtModel;
    description =
      data.description?.trim() ||
      data.prompt ||
      (isFalNanoBananaT2iModel(txtModel)
        ? isNanoBananaProT2iModel(txtModel)
          ? "Nano Banana Pro (text-to-image)."
          : "Nano Banana (text-to-image)."
        : "");
  }

  const { buffer, contentType } = await fetchImageBufferFromUrl(imageUrlForDownload);
  const ext =
    contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpeg";
  const key = `thumbnails/${params.sessionId || uuidv4()}/${uuidv4()}.${ext}`;

  const sanitizedPrompt = params.prompt
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .slice(0, 512);

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: { prompt: sanitizedPrompt },
    })
  );

  return {
    key,
    imageBase64: buffer.toString("base64"),
    mimeType: contentType,
    description,
    falModel,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageBase64, mimeType, sessionId, platforms } =
      await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const out = await generateThumbnailSchnell({
      prompt,
      imageBase64: imageBase64 || null,
      mimeType: mimeType || "image/jpeg",
      platforms,
      sessionId,
    });

    return NextResponse.json({
      url: `/api/image?key=${out.key}`,
      key: out.key,
      imageBase64: out.imageBase64,
      description: out.description,
      provider: "fal",
      falModel: out.falModel,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Thumbnail] Error:", err);

    const isTimeout =
      message.includes("timeout") ||
      message.includes("aborted") ||
      message.includes("fetch failed");

    if (isTimeout) {
      return NextResponse.json(
        {
          error:
            "Generation timed out. Try a shorter prompt or try again.",
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: `Thumbnail generation failed: ${message}` },
      { status: 500 }
    );
  }
}
