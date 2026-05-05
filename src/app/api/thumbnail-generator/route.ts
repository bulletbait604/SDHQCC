import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fal } from "@fal-ai/client";
import { GoogleGenAI, Modality } from "@google/genai";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import {
  deleteFileFromR2,
  generatePresignedReadUrl,
  getFileFromR2,
} from "@/lib/r2";

/** Vercel / long-running: Fal + R2 can exceed default 10s. */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

function mimeFromThumbnailKey(key: string): string {
  const k = key.toLowerCase();
  if (k.endsWith(".png")) return "image/png";
  if (k.endsWith(".webp")) return "image/webp";
  if (k.endsWith(".jpg") || k.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

/** Same stack as `src/app/api/tags/route.ts` — Flash is cheap and fast for short rewrite. */
const THUMBNAIL_GEMINI_MODEL_DEFAULT = "gemini-2.5-flash";
const THUMBNAIL_PROVIDER_DEFAULT = "gemini";
const FAL_KONTEXT_MODEL_DEFAULT = "fal-ai/flux-2-pro/edit";
const FAL_NANO_EDIT_MODEL_DEFAULT = "fal-ai/nano-banana/edit";

function thumbnailGeminiModelId(): string {
  return (
    process.env.THUMBNAIL_GEMINI_MODEL?.trim() || THUMBNAIL_GEMINI_MODEL_DEFAULT
  );
}

type ThumbnailProvider = "gemini" | "fal_kontext" | "fal_nano_edit";

function thumbnailProvider(): ThumbnailProvider {
  const v =
    process.env.THUMBNAIL_GENERATOR_BACKEND?.trim().toLowerCase() ||
    process.env.THUMBNAIL_IMAGE_PROVIDER?.trim().toLowerCase() ||
    THUMBNAIL_PROVIDER_DEFAULT;
  if (v === "fal_nano_edit" || v === "fal-nano-edit" || v === "nano" || v === "nano_edit") {
    return "fal_nano_edit";
  }
  if (v === "fal_kontext" || v === "fal-kontext" || v === "kontext" || v === "fal") {
    return "fal_kontext";
  }
  return "gemini";
}

function thumbnailGeminiThinkingBudget(): number {
  const raw = process.env.THUMBNAIL_GEMINI_THINKING_BUDGET?.trim() ?? "0";
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1024, n));
}

/** When true and `GEMINI_API` is set, rewrite creator notes via Gemini before Schnell. */
function thumbnailGeminiEnrichEnabled(): boolean {
  const v = process.env.THUMBNAIL_GEMINI_ENRICH?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * When `GEMINI_API` is set, run a lightweight Gemini 2.5 spell/typo pass on creator notes
 * (default on). Skipped when `THUMBNAIL_GEMINI_SPELLCHECK=0` — enrich-only runs do not double-call.
 */
function thumbnailGeminiSpellcheckEnabled(): boolean {
  if (!process.env.GEMINI_API?.trim()) return false;
  const v = process.env.THUMBNAIL_GEMINI_SPELLCHECK?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  return true;
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
 * - **FLUX.2 Flash** (`fal-ai/flux-2/flash`) — same OpenAPI shape as Turbo; Fal’s faster/cheaper FLUX.2 tier (try
 *   `FAL_THUMBNAIL_TXT2IMG_MODEL` + `FAL_THUMBNAIL_IMG2IMG_MODEL` or set only one — the route pairs `/edit`).
 * - Override with `FAL_THUMBNAIL_TXT2IMG_MODEL=fal-ai/flux-1/schnell` for legacy ultra-fast FLUX.1 Schnell (4-step).
 *
 * Image remix / Redux stays FLUX.1 Schnell Redux (`fal-ai/flux-1/schnell/redux`).
 *
 * **Image + prompt:** default `fal-ai/flux-2/turbo/edit` (same FLUX.2 family as T2I; Flash uses `…/flash/edit`).
 * Override with `FAL_THUMBNAIL_IMG2IMG_MODEL=fal-ai/flux/dev/image-to-image` for FLUX.1 dev i2i.
 *
 * **Nano Banana (Fal):** `fal-ai/nano-banana` + `fal-ai/nano-banana/edit` (Gemini 2.5 Flash Image)
 * use `aspect_ratio`, not FLUX `image_size`. **Nano Banana Pro** (`fal-ai/nano-banana-pro` / `.../edit`)
 * adds `resolution` (1K/2K/4K) and optional `enable_web_search`. Enable the whole stack with
 * `FAL_THUMBNAIL_IMAGE_STACK=nano_banana_pro` (overridable per-role with `FAL_THUMBNAIL_TXT2IMG_MODEL` / `FAL_THUMBNAIL_IMG2IMG_MODEL`).
 */
const FAL_DEFAULT_TXT2IMG_SMART = "fal-ai/nano-banana";
const FAL_LIVE_FLUX1_SCHNELL_REDUX = "fal-ai/flux-1/schnell/redux";
const FAL_DEFAULT_IMG2IMG_FLUX2_EDIT = "fal-ai/nano-banana/edit";

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

/** When only img2img is set, pair text-only to the matching FLUX.2 T2I (Flash vs Turbo). */
function falFlux2T2iFromImg2imgExplicit(img2imgId: string): string | null {
  const id = img2imgId.trim();
  if (id === "fal-ai/flux-2/flash/edit" || id.startsWith("fal-ai/flux-2/flash/edit/")) {
    return "fal-ai/flux-2/flash";
  }
  if (id === "fal-ai/flux-2/turbo/edit" || id.startsWith("fal-ai/flux-2/turbo/edit/")) {
    return "fal-ai/flux-2/turbo";
  }
  return null;
}

/** When only T2I is set, pair reference+prompt to the matching FLUX.2 edit endpoint. */
function falFlux2EditFromTxt2imgExplicit(txtId: string): string | null {
  const id = txtId.trim();
  if (
    (id === "fal-ai/flux-2/flash" || id.startsWith("fal-ai/flux-2/flash/")) &&
    id !== "fal-ai/flux-2/flash/edit" &&
    !id.startsWith("fal-ai/flux-2/flash/edit/")
  ) {
    return "fal-ai/flux-2/flash/edit";
  }
  if (
    (id === "fal-ai/flux-2/turbo" || id.startsWith("fal-ai/flux-2/turbo/")) &&
    id !== "fal-ai/flux-2/turbo/edit" &&
    !id.startsWith("fal-ai/flux-2/turbo/edit/")
  ) {
    return "fal-ai/flux-2/turbo/edit";
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
  const flux2paired =
    img2explicit && falFlux2T2iFromImg2imgExplicit(img2explicit);
  if (flux2paired) return flux2paired;
  if (thumbnailImageStack() === "nano_banana_pro") return FAL_NANO_PRO_T2I;
  return FAL_DEFAULT_TXT2IMG_SMART;
}

/**
 * FLUX.2 Turbo or Flash T2I — same OpenAPI shape; excludes `…/edit` IDs.
 * Different from FLUX.1 Schnell (no `num_inference_steps`).
 */
function isFlux2TurboTxt2Img(modelId: string): boolean {
  const id = modelId.trim();
  if (
    (id === "fal-ai/flux-2/turbo" || id.startsWith("fal-ai/flux-2/turbo/")) &&
    id !== "fal-ai/flux-2/turbo/edit" &&
    !id.startsWith("fal-ai/flux-2/turbo/edit/")
  ) {
    return true;
  }
  if (
    (id === "fal-ai/flux-2/flash" || id.startsWith("fal-ai/flux-2/flash/")) &&
    id !== "fal-ai/flux-2/flash/edit" &&
    !id.startsWith("fal-ai/flux-2/flash/edit/")
  ) {
    return true;
  }
  return false;
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

/** FLUX-only safety pass; disabling can shave inference time (use with care). */
function thumbnailFluxSafetyCheckerEnabled(): boolean {
  const v = process.env.FAL_THUMBNAIL_ENABLE_SAFETY_CHECKER?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  return true;
}

function falImg2imgModelId(): string {
  const o = process.env.FAL_THUMBNAIL_IMG2IMG_MODEL?.trim();
  if (o) return o;
  const txtExplicit = process.env.FAL_THUMBNAIL_TXT2IMG_MODEL?.trim();
  const paired =
    txtExplicit && falNanoBananaEditFromTxtExplicit(txtExplicit);
  if (paired) return paired;
  const flux2paired =
    txtExplicit && falFlux2EditFromTxt2imgExplicit(txtExplicit);
  if (flux2paired) return flux2paired;
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

/**
 * Fal image bytes format. `jpeg` often encodes faster / smaller than `png` (slight quality tradeoff).
 * Default stays `png` for lossless thumbs.
 */
function falThumbnailOutputFormat(): "png" | "jpeg" | "webp" {
  const v = process.env.FAL_THUMBNAIL_OUTPUT_FORMAT?.trim().toLowerCase();
  if (v === "jpeg" || v === "jpg") return "jpeg";
  if (v === "webp") return "webp";
  return "png";
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
    output_format: falThumbnailOutputFormat(),
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

/** FLUX.2 Turbo or Flash **edit** — `image_urls` + `prompt`; bills input+output MP per Fal. */
function isFlux2TurboEditModel(modelId: string): boolean {
  const id = modelId.trim();
  return (
    id === "fal-ai/flux-2/turbo/edit" ||
    id.startsWith("fal-ai/flux-2/turbo/edit/") ||
    id === "fal-ai/flux-2/flash/edit" ||
    id.startsWith("fal-ai/flux-2/flash/edit/")
  );
}

function isFlux2FlashEditModel(modelId: string): boolean {
  const id = modelId.trim();
  return (
    id === "fal-ai/flux-2/flash/edit" ||
    id.startsWith("fal-ai/flux-2/flash/edit/")
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
  "\n\n**Mandatory graphic thumbnail treatment:** The final image must include **real painted typography**—at least a **dominant headline** plus a **second text line** (subtitle, stat, or callout)—with **thick stroke, hard shadow, or outer glow** so it reads at tiny preview size. Add **collage-style graphic layers**: arrows, starbursts, simple badges, sparkles, or emoji-like doodles as **flat stickers** around the focal subject. Phrases should echo the instructions (or invent short hooks if none given).";

/**
 * Diffusion models (FLUX, etc.) often garble painted text. Nano Banana skips this—its stack is separate.
 */
const THUMBNAIL_FLUX_TYPOGRAPHY_SPELLING_BLOCK =
  "\n\n**On-image text—spelling accuracy (critical):** Every word you paint must match the instructions **letter-for-letter**—no swapped or missing letters, nonsense glyphs, mirror writing, or random characters. Prefer **short lines** of **simple bold block or clean sans-serif** type with a **thick outline**; avoid melting, ultra-warped, or hyper-ornate lettering that distorts letter shapes. Reproduce **proper nouns and titles exactly** as given. When inventing hook text, keep it **plain and easy to spell**.";

/** Opt-in: allow recognizable platform/game logos when user asks for branded thumbnail treatment. */
function thumbnailAllowBrandLogos(): boolean {
  const v = process.env.THUMBNAIL_ALLOW_BRAND_LOGOS?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function brandLogoOverlayBlock(
  userText: string,
  platforms: string[] | undefined
): string {
  if (!thumbnailAllowBrandLogos()) return "";
  const ids = Array.isArray(platforms) ? platforms : [];
  const targets: string[] = [];
  const seen = new Set<string>();
  const add = (label: string) => {
    const k = label.trim().toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    targets.push(label.trim());
  };

  const platformNameById: Record<string, string> = {
    "youtube-long": "YouTube",
    "youtube-shorts": "YouTube Shorts",
    tiktok: "TikTok",
    instagram: "Instagram",
    "facebook-reels": "Facebook Reels",
    twitter: "X (Twitter)",
  };
  for (const id of ids) {
    if (platformNameById[id]) add(platformNameById[id]);
  }

  const brandRules: Array<{ re: RegExp; label: string }> = [
    { re: /\bkick\b/i, label: "Kick" },
    { re: /\btwitch\b/i, label: "Twitch" },
    { re: /\byoutube\b/i, label: "YouTube" },
    { re: /\btiktok\b/i, label: "TikTok" },
    { re: /\binstagram\b/i, label: "Instagram" },
    { re: /\bfacebook\b/i, label: "Facebook" },
    { re: /\bdiablo\s*(iv|4)\b/i, label: "Diablo 4" },
    { re: /\bfortnite\b/i, label: "Fortnite" },
    { re: /\bminecraft\b/i, label: "Minecraft" },
    { re: /\bvalorant\b/i, label: "Valorant" },
    { re: /\broblox\b/i, label: "Roblox" },
    { re: /\boverwatch\b/i, label: "Overwatch" },
    { re: /\bapex\b/i, label: "Apex Legends" },
    { re: /\bwarframe\b/i, label: "Warframe" },
    { re: /\bgenshin\b/i, label: "Genshin Impact" },
    { re: /\bpokemon\b/i, label: "Pokemon" },
  ];
  for (const rule of brandRules) {
    if (rule.re.test(userText)) add(rule.label);
  }

  if (targets.length === 0) return "";

  return `\n\n**Branding mode (enabled):** Include recognizable, readable branding for these named entities: ${targets.join(", ")}. If any are platforms, include their logo/wordmark as visible badge elements. If any are games/franchises, include clear game title wordmarks and matching emblem-like badges. Keep all branding high-contrast and readable at thumbnail size.`;
}

/** Optional second refinement pass for logo/wordmark readability in FLUX edit pipelines. */
function thumbnailBrandClaritySecondPassEnabled(): boolean {
  const v = process.env.THUMBNAIL_BRAND_CLARITY_SECOND_PASS?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  return true;
}

function brandClaritySecondPassPrompt(basePrompt: string): string {
  return `${basePrompt}

SECOND PASS PRIORITY (logo/wordmark clarity):
- Keep the same composition and subject, but refine branding details.
- Ensure platform/game names and logo-like badges are crisp, readable, and correctly spelled.
- Increase contrast around brand marks with clean edge separation and subtle glow/outline.
- Remove muddy or distorted letterforms; use clear blocky type for any brand words.
- Preserve visual style while improving small-preview legibility.`;
}

function buildPromptText(
  instructionText: string,
  spec: ReturnType<typeof thumbnailSpecFromPlatforms>,
  hasImage: boolean,
  /** Original user text for keyword/domain hints (when Gemini rewrites `instructionText`). */
  domainKeywordSource?: string,
  /** Echo creator wording when an LLM rewrote instructions—keeps proper nouns (games, platforms). */
  literalAnchorSource?: string,
  platforms?: string[],
  mustKeepBlock?: string,
  /** Extra spelling/legibility pressure for diffusion-rendered typography (FLUX family). */
  includeFluxTypographySpellingHints?: boolean
): string {
  const domain = domainHintsForPrompt(domainKeywordSource ?? instructionText);
  const keywordSource = domainKeywordSource ?? instructionText;
  const streamBlock = streamThumbnailTypographyBlock(keywordSource);
  const platformOverlay = platformOverlayHintsFromPlatforms(platforms);
  const brandLogoBlock = brandLogoOverlayBlock(keywordSource, platforms);
  const fluxSpelling = includeFluxTypographySpellingHints
    ? THUMBNAIL_FLUX_TYPOGRAPHY_SPELLING_BLOCK
    : "";

  const fidelity =
    literalAnchorSource &&
    literalAnchorSource.trim() !== instructionText.trim()
      ? `\n\nCreator anchors (these phrases MUST shape mood, setting, composition, and any on-image titles): ${literalAnchorSource.trim()}`
      : "";

  const obeyLiteral =
    "\n\nPriority: The creator's topic comes first—avoid unrelated generic stock scenes. For stream/social thumbs, **spell out platform names and hooks as bold graphic type in-frame** when they said Twitch etc. Games/platforms still guide palette and mood.";

  return hasImage
    ? `You are a professional multi-platform thumbnail designer. An image is provided—compose around it and honor the text below.${obeyLiteral}

Instructions: ${instructionText}${fidelity}${domain}${streamBlock}${platformOverlay}${brandLogoBlock}${fluxSpelling}${THUMBNAIL_GRAPHIC_OVERLAY_CONTRACT}${mustKeepBlock ? `\n\nNon-negotiable request checklist:\n${mustKeepBlock}` : ""}

Output dimensions: ${spec.pixels} (${spec.label}). ${spec.aspectNote}
High contrast, bold colors, clear visual hierarchy—**all headline and sticker graphics must be fully rendered inside the image pixels** (never implied or left for post-production).`
    : `You are a professional multi-platform thumbnail designer.${obeyLiteral}

Instructions: ${instructionText}${fidelity}${domain}${streamBlock}${platformOverlay}${brandLogoBlock}${fluxSpelling}${THUMBNAIL_GRAPHIC_OVERLAY_CONTRACT}${mustKeepBlock ? `\n\nNon-negotiable request checklist:\n${mustKeepBlock}` : ""}

Output dimensions: ${spec.pixels} (${spec.label}). ${spec.aspectNote}
High contrast, bold colors, clear visual hierarchy—**all headline and sticker graphics must be fully rendered inside the image pixels** (never implied or left for post-production).`;
}

function extractMustKeepChecklist(prompt: string): string {
  const cleaned = prompt
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";

  const quoted = Array.from(cleaned.matchAll(/"([^"]{2,80})"/g))
    .map((m) => m[1].trim())
    .filter(Boolean);
  const chunks = cleaned
    .split(/[.;,!?\-]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
  const merged = [...quoted, ...chunks].map((s) => s.replace(/^and\s+/i, ""));

  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const item of merged) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(item);
    if (uniq.length >= 8) break;
  }
  return uniq.map((u) => `- ${u}`).join("\n");
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

**Step 1 — spelling:** Infer the creator's intent and **fix misspellings and typos** (game/stream titles, platform names, people/channel names, common words). Use **standard correct spellings** for any text that should appear on the thumbnail. If something is ambiguous slang or clearly intentional stylization, keep the intent.

**Step 2 — rewrite:** Turn the (now spelling-correct) notes into ONE concise paragraph (max 110 words) of concrete visual directions: subject, mood, lighting, palette, composition, plus **exact short strings** the model must **paint as on-image typography** (e.g. "LIVE ON TWITCH", "NEW GAME — WINDROSE", a funny one-liner)—not "space for text" or "add title later". Those strings must use the **corrected spellings** from step 1. Also name **2–4 graphic sticker elements** to include (arrow, starburst, badge shape, emoji doodle) so the frame looks like a real social thumbnail—not a clean movie poster.

CRITICAL—keep fidelity to what they wrote:
• **Spelling:** Any exact phrase you tell the image model to paint must be **correctly spelled**; when the creator mistyped, use the **fixed** spelling in on-image strings. For new hook lines you invent, use **short, simple, easy-to-read** words (diffusion models often garble ornate type).
• If they name a streaming platform (Twitch, Kick, YouTube Live, etc.), prescribe **busy stream-thumb layout**: purple/black Twitch energy when relevant, chunky outlined lettering, HUD corners; propose exact short phrases for on-image typography.
• If they name a game, franchise, or title (e.g. indie games, RPGs, Windrose, etc.), translate it into matching genre art direction—fantasy forest vs sci-fi HUD vs anime RPG mood—and include the game name as clear on-image text when useful.
• Do NOT drop proper nouns that carry meaning; name platforms and games as theme anchors and include logo/wordmark cues when requested.

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
      config: {
        thinkingConfig: {
          thinkingBudget: thumbnailGeminiThinkingBudget(),
        },
      },
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

/** Short Gemini pass: fix typos only (same model family as enrich — default gemini-2.5-flash). */
async function spellcheckThumbnailBriefWithGemini(params: {
  userPrompt: string;
}): Promise<string | null> {
  const apiKey = process.env.GEMINI_API?.trim();
  if (!apiKey) {
    return null;
  }

  const safeNotes = params.userPrompt.replace(/"""/g, '"');
  const metaPrompt = `You correct spelling in creator notes for a video thumbnail image generator (the notes are later sent to a diffusion model that paints text into pixels).

Rules:
• Fix clear misspellings in ordinary words, titles, platform names (Twitch, YouTube, etc.), and proper nouns when the intended word is obvious.
• If a word is ambiguous or intentional creator slang/stylization, keep it.
• Do NOT rewrite into a long visual brief—keep the same length and scope as the input (a short note stays a short note).
• Output ONLY the corrected notes as plain text—no markdown, no bullet list, no quotes wrapping the whole answer, no preamble like "Here is".

Creator notes:
"""
${safeNotes}
"""`;

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.generateContent({
      model: thumbnailGeminiModelId(),
      contents: [{ role: "user", parts: [{ text: metaPrompt }] }],
      config: {
        thinkingConfig: {
          thinkingBudget: thumbnailGeminiThinkingBudget(),
        },
      },
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
    if (!cleaned || cleaned.length < 3) {
      return null;
    }
    return cleaned;
  } catch (e) {
    console.warn("[Thumbnail] Gemini spellcheck failed:", e);
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

function findFirstImageUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const s = value.trim();
    if (!/^https?:\/\//i.test(s)) return null;
    if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(s) || /images?\./i.test(s)) return s;
    return s;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findFirstImageUrl(item);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    for (const entry of Object.values(rec)) {
      const hit = findFirstImageUrl(entry);
      if (hit) return hit;
    }
  }
  return null;
}

function buildFalEditInput(prompt: string, imageUrl?: string): Record<string, unknown> {
  const input: Record<string, unknown> = { prompt };
  if (imageUrl) {
    // Some Fal edit models expect `image_url`, while others expect `image_urls`.
    // Provide both so re-edit always anchors to the intended source image.
    input.image_url = imageUrl;
    input.image_urls = [imageUrl];
  }
  return input;
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
  mimeType: string;
  description: string;
  model: string;
  geminiEnrichUsed: boolean;
  geminiSpellcheckUsed: boolean;
};

type GeminiImageOutput = {
  buffer: Buffer;
  contentType: string;
};

const GEMINI_IMAGE_MODEL_FALLBACKS = [
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.0-flash-exp-image-generation",
];

function isModelNotFoundError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || "");
  const s = msg.toLowerCase();
  return (
    s.includes("not found") ||
    s.includes('"code":404') ||
    s.includes("status\":\"not_found\"") ||
    s.includes("is not supported for generatecontent")
  );
}

function buildImageModelCandidates(primaryModel: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (m: string | undefined) => {
    const v = (m || "").trim();
    if (!v || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };
  add(primaryModel);
  for (const m of GEMINI_IMAGE_MODEL_FALLBACKS) add(m);
  return out;
}

async function generateGeminiImage(params: {
  genAI: GoogleGenAI;
  imageModel: string;
  promptText: string;
  imageBase64: string | null;
  mimeType: string;
}): Promise<GeminiImageOutput> {
  const parts: Array<
    | { inlineData?: { data?: string; mimeType?: string } }
    | { text?: string }
  > = [];
  if (params.imageBase64) {
    parts.push({
      inlineData: {
        data: params.imageBase64,
        mimeType: params.mimeType || "image/jpeg",
      },
    });
  }
  parts.push({ text: params.promptText });

  const response = await params.genAI.models.generateContent({
    model: params.imageModel,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const responseParts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = responseParts.find((p: any) =>
    p?.inlineData?.mimeType?.startsWith?.("image/")
  ) as { inlineData?: { data?: string; mimeType?: string } } | undefined;

  if (!imagePart?.inlineData?.data || !imagePart.inlineData.mimeType) {
    throw new Error("Gemini did not return an image. Try rephrasing your prompt.");
  }

  return {
    buffer: Buffer.from(imagePart.inlineData.data, "base64"),
    contentType: imagePart.inlineData.mimeType,
  };
}

async function generateGeminiImageWithModelFallback(params: {
  genAI: GoogleGenAI;
  primaryModel: string;
  promptText: string;
  imageBase64: string | null;
  mimeType: string;
}): Promise<{ output: GeminiImageOutput; model: string }> {
  const candidates = buildImageModelCandidates(params.primaryModel);
  let lastError: unknown = null;
  for (const model of candidates) {
    try {
      const output = await generateGeminiImage({
        genAI: params.genAI,
        imageModel: model,
        promptText: params.promptText,
        imageBase64: params.imageBase64,
        mimeType: params.mimeType,
      });
      return { output, model };
    } catch (error) {
      lastError = error;
      if (!isModelNotFoundError(error)) throw error;
      console.warn(`[Thumbnail] Model unavailable for generateContent: ${model}`);
    }
  }
  throw lastError || new Error("No compatible Gemini image model found.");
}

async function generateThumbnailSchnell(params: {
  prompt: string;
  imageBase64: string | null;
  mimeType: string;
  platforms: string[] | undefined;
  sessionId: string | undefined;
}): Promise<ThumbnailGenResult> {
  const apiKey = process.env.GEMINI_API?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API is required for thumbnail generation.");
  }
  const genAI = new GoogleGenAI({ apiKey });
  const imageModel =
    process.env.THUMBNAIL_GEMINI_IMAGE_MODEL?.trim() ||
    "gemini-2.5-flash-image";
  const maxPromptLength = 500;
  const truncatedPrompt =
    params.prompt.length > maxPromptLength
      ? params.prompt.slice(0, maxPromptLength) + "..."
      : params.prompt;
  let geminiEnrichUsed = false;
  let geminiSpellcheckUsed = false;
  let instructionPrompt = truncatedPrompt;

  const enrichOn = thumbnailGeminiEnrichEnabled();
  const spellcheckOn = thumbnailGeminiSpellcheckEnabled();
  if (enrichOn) {
    const enriched = await enrichThumbnailBriefWithGemini({
      userPrompt: truncatedPrompt,
      platforms: params.platforms,
    });
    if (enriched) {
      geminiEnrichUsed = true;
      instructionPrompt =
        enriched.length > maxPromptLength
          ? enriched.slice(0, maxPromptLength) + "..."
          : enriched;
    }
  }

  if (!geminiEnrichUsed && spellcheckOn) {
    const fixed = await spellcheckThumbnailBriefWithGemini({
      userPrompt: truncatedPrompt,
    });
    if (fixed) {
      geminiSpellcheckUsed = true;
      instructionPrompt =
        fixed.length > maxPromptLength
          ? fixed.slice(0, maxPromptLength) + "..."
          : fixed;
    }
  }

  const spec = thumbnailSpecFromPlatforms(params.platforms);
  const useFluxTypographySpellingHints = false;

  const domainKeywordSource = geminiEnrichUsed
    ? truncatedPrompt
    : instructionPrompt.trim() !== truncatedPrompt.trim()
      ? instructionPrompt
      : truncatedPrompt;
  const literalAnchorSource =
    geminiEnrichUsed &&
    instructionPrompt.trim() !== truncatedPrompt.trim()
      ? truncatedPrompt
      : undefined;
  const mustKeepChecklist = extractMustKeepChecklist(truncatedPrompt);

  const promptText = buildPromptText(
    instructionPrompt,
    spec,
    !!params.imageBase64,
    domainKeywordSource,
    literalAnchorSource,
    params.platforms,
    mustKeepChecklist,
    useFluxTypographySpellingHints
  );
  const firstPass = await generateGeminiImageWithModelFallback({
    genAI,
    primaryModel: imageModel,
    promptText,
    imageBase64: params.imageBase64,
    mimeType: params.mimeType,
  });
  let { buffer, contentType } = firstPass.output;
  const selectedImageModel = firstPass.model;

  // Guard against occasional no-op returns when a reference image is provided.
  if (params.imageBase64) {
    const inputHash = createHash("sha256")
      .update(Buffer.from(params.imageBase64, "base64"))
      .digest("hex");
    const outputHash = createHash("sha256").update(buffer).digest("hex");
    if (inputHash === outputHash) {
      const hardEditPrompt = `${promptText}

CRITICAL EDIT REQUIREMENT:
- Do NOT return the original image unchanged.
- Apply clear visual transformation: new background treatment, stronger lighting/color grade, added graphic overlays, and re-composed focal hierarchy.
- Output must be a visibly edited thumbnail variant, not a copy of the source frame.`;
      const retry = await generateGeminiImage({
        genAI,
        imageModel: selectedImageModel,
        promptText: hardEditPrompt,
        imageBase64: params.imageBase64,
        mimeType: params.mimeType,
      });
      buffer = retry.buffer;
      contentType = retry.contentType;
    }
  }
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
    mimeType: contentType,
    description: "Gemini-generated thumbnail",
    model: selectedImageModel,
    geminiEnrichUsed,
    geminiSpellcheckUsed,
  };
}

async function generateThumbnailFalKontext(params: {
  prompt: string;
  imageBase64: string | null;
  mimeType: string;
  platforms: string[] | undefined;
  sessionId: string | undefined;
}): Promise<ThumbnailGenResult> {
  const falKey = process.env.FAL_KEY?.trim() || process.env.FAL_API_KEY?.trim();
  if (!falKey) {
    throw new Error("FAL_KEY (or FAL_API_KEY) is required for fal_kontext provider.");
  }

  fal.config({ credentials: falKey });
  const modelId =
    process.env.FAL_THUMBNAIL_MODEL?.trim() || FAL_KONTEXT_MODEL_DEFAULT;
  const requiresImageInput =
    modelId === "fal-ai/flux-2-pro/edit" || modelId.endsWith("/edit");
  if (requiresImageInput && !params.imageBase64) {
    throw new Error(`${modelId} requires a source image. Upload an image and try again.`);
  }
  const spec = thumbnailSpecFromPlatforms(params.platforms);
  const mustKeepChecklist = extractMustKeepChecklist(params.prompt);
  const promptText = buildPromptText(
    params.prompt,
    spec,
    !!params.imageBase64,
    params.prompt,
    params.prompt,
    params.platforms,
    mustKeepChecklist,
    true
  );

  const staged = params.imageBase64
    ? await stagingImageUrlForFal({
        imageBase64: params.imageBase64,
        mimeType: params.mimeType,
        sessionId: params.sessionId,
      })
    : { imageUrl: "", stagingKey: null as string | null };

  try {
    const input = buildFalEditInput(promptText, staged.imageUrl || undefined);

    const result = await fal.subscribe(modelId, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          for (const log of update.logs ?? []) {
            console.log("[Thumbnail][FalKontext]", log.message);
          }
        }
      },
    });

    const imageUrl =
      findFirstImageUrl((result as { data?: unknown }).data) ||
      findFirstImageUrl(result);
    if (!imageUrl) {
      throw new Error("Fal Kontext returned no image URL.");
    }
    let finalImageUrl = imageUrl;
    const shouldRunBrandSecondPass =
      thumbnailAllowBrandLogos() &&
      thumbnailBrandClaritySecondPassEnabled() &&
      isFlux2TurboEditModel(modelId);

    if (shouldRunBrandSecondPass) {
      try {
        const secondPass = await fal.subscribe(modelId, {
          input: buildFalEditInput(brandClaritySecondPassPrompt(promptText), finalImageUrl),
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
              for (const log of update.logs ?? []) {
                console.log("[Thumbnail][FalKontext][BrandPass]", log.message);
              }
            }
          },
        });
        const secondImageUrl =
          findFirstImageUrl((secondPass as { data?: unknown }).data) ||
          findFirstImageUrl(secondPass);
        if (secondImageUrl) {
          finalImageUrl = secondImageUrl;
        }
      } catch (e) {
        console.warn("[Thumbnail] Brand clarity second pass failed; using first pass output:", e);
      }
    }

    const downloaded = await fetchImageBufferFromUrl(finalImageUrl);
    const ext =
      downloaded.contentType.includes("png")
        ? "png"
        : downloaded.contentType.includes("webp")
          ? "webp"
          : "jpeg";
    const key = `thumbnails/${params.sessionId || uuidv4()}/${uuidv4()}.${ext}`;
    const sanitizedPrompt = params.prompt
      .replace(/[\r\n]+/g, " ")
      .replace(/[^\x20-\x7E]/g, "")
      .slice(0, 512);

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: downloaded.buffer,
        ContentType: downloaded.contentType,
        Metadata: { prompt: sanitizedPrompt },
      })
    );

    return {
      key,
      mimeType: downloaded.contentType,
      description: "Fal Flux generated thumbnail",
      model: modelId,
      geminiEnrichUsed: false,
      geminiSpellcheckUsed: false,
    };
  } finally {
    if (staged.stagingKey) {
      await deleteFileFromR2(staged.stagingKey).catch(() => {});
    }
  }
}

async function generateThumbnailFalNanoEdit(params: {
  prompt: string;
  imageBase64: string | null;
  mimeType: string;
  platforms: string[] | undefined;
  sessionId: string | undefined;
}): Promise<ThumbnailGenResult> {
  const falKey = process.env.FAL_KEY?.trim() || process.env.FAL_API_KEY?.trim();
  if (!falKey) {
    throw new Error("FAL_KEY (or FAL_API_KEY) is required for fal_nano_edit provider.");
  }
  if (!params.imageBase64) {
    throw new Error("fal-ai/nano-banana/edit requires a source image. Upload an image and try again.");
  }
  fal.config({ credentials: falKey });
  const modelId = process.env.FAL_THUMBNAIL_NANO_MODEL?.trim() || FAL_NANO_EDIT_MODEL_DEFAULT;
  const spec = thumbnailSpecFromPlatforms(params.platforms);
  const mustKeepChecklist = extractMustKeepChecklist(params.prompt);
  const promptText = buildPromptText(
    params.prompt,
    spec,
    true,
    params.prompt,
    params.prompt,
    params.platforms,
    mustKeepChecklist,
    true
  );
  const staged = await stagingImageUrlForFal({
    imageBase64: params.imageBase64,
    mimeType: params.mimeType,
    sessionId: params.sessionId,
  });
  try {
    const result = await fal.subscribe(modelId, {
      input: buildFalEditInput(promptText, staged.imageUrl),
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          for (const log of update.logs ?? []) {
            console.log("[Thumbnail][FalNanoEdit]", log.message);
          }
        }
      },
    });
    const imageUrl =
      findFirstImageUrl((result as { data?: unknown }).data) ||
      findFirstImageUrl(result);
    if (!imageUrl) throw new Error("Fal nano edit returned no image URL.");
    const downloaded = await fetchImageBufferFromUrl(imageUrl);
    const ext =
      downloaded.contentType.includes("png")
        ? "png"
        : downloaded.contentType.includes("webp")
          ? "webp"
          : "jpeg";
    const key = `thumbnails/${params.sessionId || uuidv4()}/${uuidv4()}.${ext}`;
    const sanitizedPrompt = params.prompt
      .replace(/[\r\n]+/g, " ")
      .replace(/[^\x20-\x7E]/g, "")
      .slice(0, 512);
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: downloaded.buffer,
        ContentType: downloaded.contentType,
        Metadata: { prompt: sanitizedPrompt },
      })
    );
    return {
      key,
      mimeType: downloaded.contentType,
      description: "Fal Nano Banana edit generated thumbnail",
      model: modelId,
      geminiEnrichUsed: false,
      geminiSpellcheckUsed: false,
    };
  } finally {
    if (staged.stagingKey) {
      await deleteFileFromR2(staged.stagingKey).catch(() => {});
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt,
      imageBase64,
      sourceImageKey,
      mimeType,
      sessionId,
      platforms,
    } = body as {
      prompt?: string;
      imageBase64?: string;
      sourceImageKey?: string;
      mimeType?: string;
      sessionId?: string;
      platforms?: string[];
    };

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    let effectiveB64: string | null =
      typeof imageBase64 === "string" && imageBase64.length > 0
        ? imageBase64
        : null;
    let effectiveMime =
      typeof mimeType === "string" && mimeType.length > 0
        ? mimeType
        : "image/jpeg";

    if (typeof sourceImageKey === "string" && sourceImageKey.trim()) {
      const sk = sourceImageKey.trim();
      if (!sk.startsWith("thumbnails/")) {
        return NextResponse.json(
          { error: "Invalid source image key" },
          { status: 400 }
        );
      }
      const buf = await getFileFromR2(sk);
      if (!buf) {
        return NextResponse.json(
          { error: "Source image not found or could not be read" },
          { status: 404 }
        );
      }
      effectiveB64 = buf.toString("base64");
      effectiveMime = mimeFromThumbnailKey(sk);
    }

    const provider = thumbnailProvider();
    const out =
      provider === "fal_kontext"
        ? await generateThumbnailFalKontext({
            prompt,
            imageBase64: effectiveB64,
            mimeType: effectiveMime,
            platforms,
            sessionId,
          })
        : provider === "fal_nano_edit"
          ? await generateThumbnailFalNanoEdit({
              prompt,
              imageBase64: effectiveB64,
              mimeType: effectiveMime,
              platforms,
              sessionId,
            })
        : await generateThumbnailSchnell({
            prompt,
            imageBase64: effectiveB64,
            mimeType: effectiveMime,
            platforms,
            sessionId,
          });

    const estimate = {
      estimatedCostUsd: 0.003,
      estimatedCostNote:
        "Gemini 2.5 Flash image generation (rough estimate).",
    };

    const encKey = encodeURIComponent(out.key);

    return NextResponse.json({
      url: `/api/image?key=${encKey}`,
      key: out.key,
      mimeType: out.mimeType,
      description: out.description,
      provider: provider === "gemini" ? "gemini" : "fal",
      falModel: out.model,
      estimatedCostUsd: estimate.estimatedCostUsd,
      estimatedCostNote: estimate.estimatedCostNote,
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
