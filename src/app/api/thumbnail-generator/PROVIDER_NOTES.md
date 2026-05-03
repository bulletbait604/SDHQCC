# Thumbnail generator (Fal)

Thumbnails are generated **only** via Fal. Live endpoint IDs (OpenAPI):

| Role | Default model ID |
|------|------------------|
| Text-to-image | `fal-ai/flux-2/turbo` (FLUX.2 Turbo T2I) |
| Reference + written prompt | `fal-ai/flux-2/turbo/edit` (FLUX.2 Turbo edit — input+output billed per MP on Fal) |
| Reference, Schnell remix only (no text steering in API) | `fal-ai/flux-1/schnell/redux` |

- **Stack preset (Gemini image on Fal):** `FAL_THUMBNAIL_IMAGE_STACK=nano_banana_pro` (aliases: `pro`, `smart_nano`) switches defaults to **`fal-ai/nano-banana-pro`** (T2I) and **`fal-ai/nano-banana-pro/edit`** (reference + prompt)—**text-only** requests use the T2I id, not FLUX. If you set only **`FAL_THUMBNAIL_IMG2IMG_MODEL=fal-ai/nano-banana-pro/edit`** (or Flash `…/nano-banana/edit`) and leave T2I unset, the route **pairs** text-only to **`fal-ai/nano-banana-pro`** (or `fal-ai/nano-banana`) automatically. Same in reverse when only T2I is set. Platform selection maps to Fal **`aspect_ratio`** (`16:9`, `9:16`, `4:5`), not FLUX `image_size`. Pro-only: `FAL_THUMBNAIL_NANO_PRO_RESOLUTION` (`1K` default, `2K`, `4K`), `FAL_THUMBNAIL_NANO_PRO_WEB_SEARCH=1`, `FAL_THUMBNAIL_NANO_SAFETY_TOLERANCE` (`1`–`6`). Per-role env overrides still win when both vars are explicitly set (e.g. mix FLUX + Nano intentionally).

- **No reference image:** `fal-ai/flux-2/turbo` by default (`enable_prompt_expansion` on unless `FAL_THUMBNAIL_FLUX2_PROMPT_EXPANSION=0`). Set `FAL_THUMBNAIL_TXT2IMG_MODEL=fal-ai/flux-1/schnell` to use legacy FLUX.1 Schnell only.
- **With reference image:** `fal-ai/flux-2/turbo/edit` by default (`image_urls` + `prompt`; matches FLUX.2 Turbo T2I). Set `FAL_THUMBNAIL_IMG2IMG_MODEL=fal-ai/flux/dev/image-to-image` for FLUX.1 dev i2i (`strength` / steps). Set `FAL_THUMBNAIL_IMG2IMG_MODEL=fal-ai/flux-1/schnell/redux` for remix-only (no prompt to Fal).

**Auth:** `SCHNELL_API_KEY` or `FAL_KEY` (or `FAL_API_KEY`).

**Optional env:** `FAL_THUMBNAIL_IMAGE_STACK` (`flux` default; `nano_banana_pro` / `smart_nano` / `pro`), `FAL_THUMBNAIL_TXT2IMG_MODEL`, `FAL_THUMBNAIL_FLUX2_PROMPT_EXPANSION` (default on), `FAL_THUMBNAIL_FLUX2_GUIDANCE_SCALE` (default `2.5`), `FAL_THUMBNAIL_IMG2IMG_MODEL`, `FAL_THUMBNAIL_IMG2IMG_STRENGTH` (default `0.65`), `FAL_THUMBNAIL_IMG2IMG_STEPS` (default `28`; dev i2i allows 10–50), `FAL_THUMBNAIL_SCHNELL_REDUX_STEPS` (default `4`; Redux allows 1–12), Nano Pro: `FAL_THUMBNAIL_NANO_PRO_RESOLUTION`, `FAL_THUMBNAIL_NANO_PRO_WEB_SEARCH`, `FAL_THUMBNAIL_NANO_SAFETY_TOLERANCE`.

**Reference image → Fal:** By default the route uploads the reference to R2 under `thumbnails/.../fal-source-*`, sends Fal a **presigned GET URL** (small JSON body, like Fal’s `image_url: "https://..."` examples), then deletes the staging object after the Fal call. Set `FAL_THUMBNAIL_DISABLE_R2_SOURCE_STAGING=1` to embed base64 `data:` URIs instead. `FAL_THUMBNAIL_SOURCE_READ_URL_SEC` (default `7200`) controls presigned URL lifetime.

**Optional Gemini prompt rewrite:** Set `THUMBNAIL_GEMINI_ENRICH=1` and configure `GEMINI_API`. The route calls Gemini (default model `gemini-2.5-flash`, override with `THUMBNAIL_GEMINI_MODEL`) once per request to turn creator notes into a tighter visual brief for Schnell/FLUX; rule-based domain hints still use the **original** truncated text for keyword matching. If Gemini fails or is disabled, generation falls back to the non-LLM path only.
