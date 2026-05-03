/**
 * Rough API cost hints for owners (not invoicing-grade). Overrides via env:
 * ESTIMATE_FLUX_USD_PER_MP, ESTIMATE_NANO_FLASH_USD, ESTIMATE_NANO_PRO_1K2K_USD,
 * ESTIMATE_NANO_PRO_4K_USD, ESTIMATE_FAL_REDUX_USD, ESTIMATE_THUMBNAIL_GEMINI_ENRICH_USD,
 * ESTIMATE_TAG_GEMINI_USD, ESTIMATE_TAG_FAL_OPENROUTER_USD, ESTIMATE_CLIP_ANALYSIS_USD.
 */

const FLUX_DEF = 0.008
const NANO_FLASH_DEF = 0.039
const NANO_PRO_12K_DEF = 0.15
const NANO_PRO_4K_DEF = 0.3

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (raw === undefined || raw === "") return fallback
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/** Matches `falImageSizeFromPlatforms` output areas (conservative Fal preset sizes). */
export function approxThumbnailOutputMegapixels(
  platforms: string[] | undefined
): number {
  const ids = Array.isArray(platforms) ? platforms : []
  const wantsPortrait =
    ids.some((id) =>
      ["youtube-shorts", "tiktok", "facebook-reels"].includes(id)
    ) && !ids.some((id) => id === "youtube-long")
  const wantsInstagram = ids.includes("instagram")
  const wantsLandscape =
    ids.includes("youtube-long") ||
    ids.includes("twitter") ||
    (!wantsPortrait && !wantsInstagram && ids.length > 0)

  if (wantsInstagram && !wantsPortrait && !ids.includes("youtube-long")) {
    return (1080 * 1350) / 1_000_000
  }
  if (wantsPortrait || (wantsInstagram && !wantsLandscape)) {
    return (1080 * 1920) / 1_000_000
  }
  return (1280 * 720) / 1_000_000
}

function nanoProTierUsd(): number {
  const tier =
    process.env.FAL_THUMBNAIL_NANO_PRO_RESOLUTION?.trim().toUpperCase() ?? "1K"
  if (tier === "4K") {
    return numEnv("ESTIMATE_NANO_PRO_4K_USD", NANO_PRO_4K_DEF)
  }
  return numEnv("ESTIMATE_NANO_PRO_1K2K_USD", NANO_PRO_12K_DEF)
}

/** FLUX edit: Fal bills ~input MP (capped) + output MP for turbo edit. */
const FLUX_EDIT_INPUT_MP_ASSUMED = 1

export function estimateThumbnailGenerationUsd(params: {
  falModel: string
  platforms: string[] | undefined
  hadReferenceImage: boolean
  geminiEnrichUsed: boolean
}): { estimatedCostUsd: number; estimatedCostNote: string } {
  const id = params.falModel.trim()
  const lines: string[] = []
  let main = 0

  const isProT2i = id === "fal-ai/nano-banana-pro"
  const isProEdit = id === "fal-ai/nano-banana-pro/edit"
  const isFlashT2i = id === "fal-ai/nano-banana"
  const isFlashEdit = id === "fal-ai/nano-banana/edit"

  const isRedux =
    id === "fal-ai/flux-1/schnell/redux" ||
    id === "fal-ai/flux/schnell/redux"
  const isFlux2TurboT2i =
    id === "fal-ai/flux-2/turbo" || id.startsWith("fal-ai/flux-2/turbo/")
  const isFlux2TurboEdit =
    id === "fal-ai/flux-2/turbo/edit" ||
    id.startsWith("fal-ai/flux-2/turbo/edit/")
  const mp = approxThumbnailOutputMegapixels(params.platforms)
  const fluxRate = numEnv("ESTIMATE_FLUX_USD_PER_MP", FLUX_DEF)

  if (isProT2i || isProEdit) {
    main = nanoProTierUsd()
    const tierLabel =
      process.env.FAL_THUMBNAIL_NANO_PRO_RESOLUTION?.trim().toUpperCase() ||
      "1K"
    lines.push(
      params.hadReferenceImage
        ? `Nano Banana Pro edit (~${tierLabel} tier, Fal est.)`
        : `Nano Banana Pro T2I (~${tierLabel} tier, Fal est.)`
    )
  } else if (isFlashT2i || isFlashEdit) {
    main = numEnv("ESTIMATE_NANO_FLASH_USD", NANO_FLASH_DEF)
    lines.push(
      params.hadReferenceImage
        ? "Nano Banana Flash edit (flat / image, Fal est.)"
        : "Nano Banana Flash T2I (flat / image, Fal est.)"
    )
  } else if (isRedux) {
    main = numEnv("ESTIMATE_FAL_REDUX_USD", 0.004)
    lines.push("FLUX.1 Schnell Redux remix (Fal est.)")
  } else if (isFlux2TurboEdit) {
    main = fluxRate * (FLUX_EDIT_INPUT_MP_ASSUMED + mp)
    lines.push(
      `FLUX.2 Turbo edit ~${(FLUX_EDIT_INPUT_MP_ASSUMED + mp).toFixed(2)} MP @ $${fluxRate}/MP (Fal est.)`
    )
  } else if (isFlux2TurboT2i) {
    main = fluxRate * mp
    lines.push(`FLUX.2 Turbo ~${mp.toFixed(2)} MP out @ $${fluxRate}/MP (Fal est.)`)
  } else if (id.includes("flux") && params.hadReferenceImage) {
    main = fluxRate * (FLUX_EDIT_INPUT_MP_ASSUMED + mp)
    lines.push(`FLUX i2i ~${(FLUX_EDIT_INPUT_MP_ASSUMED + mp).toFixed(2)} MP @ $${fluxRate}/MP (assumed, Fal est.)`)
  } else if (id.includes("flux")) {
    main = fluxRate * mp
    lines.push(`FLUX T2I ~${mp.toFixed(2)} MP @ $${fluxRate}/MP (assumed, Fal est.)`)
  } else {
    main = fluxRate * (params.hadReferenceImage ? FLUX_EDIT_INPUT_MP_ASSUMED + mp : mp)
    lines.push(`Unknown Fal model ${id}; MP fallback (est.)`)
  }

  let enrich = 0
  if (params.geminiEnrichUsed) {
    enrich = numEnv("ESTIMATE_THUMBNAIL_GEMINI_ENRICH_USD", 0.0005)
    lines.push(
      `Gemini prompt enrich (${process.env.THUMBNAIL_GEMINI_MODEL || "gemini-2.5-flash"}, rough)`
    )
  }

  const total = main + enrich
  return {
    estimatedCostUsd: Math.round(total * 100_000) / 100_000,
    estimatedCostNote: lines.join("; "),
  }
}

export function estimateTagGenerationUsd(params: {
  backend: "gemini" | "fal"
}): { estimatedCostUsd: number; estimatedCostNote: string } {
  if (params.backend === "fal") {
    const u = numEnv("ESTIMATE_TAG_FAL_OPENROUTER_USD", 0.0004)
    return {
      estimatedCostUsd: u,
      estimatedCostNote: `Tag LLM via Fal OpenRouter (rough; model: ${process.env.FAL_TAG_LLM_MODEL || "google/gemini-2.5-flash"})`,
    }
  }
  const u = numEnv("ESTIMATE_TAG_GEMINI_USD", 0.0002)
  return {
    estimatedCostUsd: u,
    estimatedCostNote: `Gemini tags (flash-class call, tokens est.)`,
  }
}

/** Clip analyzer uses Gemini + video ingestion; varies by runtime. Flat estimate. */
export function estimateClipAnalysisUsd(): {
  estimatedCostUsd: number
  estimatedCostNote: string
} {
  const u = numEnv("ESTIMATE_CLIP_ANALYSIS_USD", 0.025)
  return {
    estimatedCostUsd: u,
    estimatedCostNote:
      "Clip analysis (Gemini video + JSON out; varies by clip length — flat est.)",
  }
}
