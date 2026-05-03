# Thumbnail generator (Fal)

Thumbnails are generated **only** via Fal. Live endpoint IDs (OpenAPI):

| Role | Default model ID |
|------|------------------|
| Text-to-image | `fal-ai/flux-2/turbo` (FLUX.2 Turbo T2I) |
| Reference + written prompt | `fal-ai/flux-2/turbo/edit` (FLUX.2 Turbo edit — input+output billed per MP on Fal) |
| Reference, Schnell remix only (no text steering in API) | `fal-ai/flux-1/schnell/redux` |

- **No reference image:** `fal-ai/flux-2/turbo` by default (`enable_prompt_expansion` on unless `FAL_THUMBNAIL_FLUX2_PROMPT_EXPANSION=0`). Set `FAL_THUMBNAIL_TXT2IMG_MODEL=fal-ai/flux-1/schnell` to use legacy FLUX.1 Schnell only.
- **With reference image:** `fal-ai/flux-2/turbo/edit` by default (`image_urls` + `prompt`; matches FLUX.2 Turbo T2I). Set `FAL_THUMBNAIL_IMG2IMG_MODEL=fal-ai/flux/dev/image-to-image` for FLUX.1 dev i2i (`strength` / steps). Set `FAL_THUMBNAIL_IMG2IMG_MODEL=fal-ai/flux-1/schnell/redux` for remix-only (no prompt to Fal).

**Auth:** `SCHNELL_API_KEY` or `FAL_KEY` (or `FAL_API_KEY`).

**Optional env:** `FAL_THUMBNAIL_TXT2IMG_MODEL`, `FAL_THUMBNAIL_FLUX2_PROMPT_EXPANSION` (default on), `FAL_THUMBNAIL_FLUX2_GUIDANCE_SCALE` (default `2.5`), `FAL_THUMBNAIL_IMG2IMG_MODEL`, `FAL_THUMBNAIL_IMG2IMG_STRENGTH` (default `0.65`), `FAL_THUMBNAIL_IMG2IMG_STEPS` (default `28`; dev i2i allows 10–50), `FAL_THUMBNAIL_SCHNELL_REDUX_STEPS` (default `4`; Redux allows 1–12).

**Reference image → Fal:** By default the route uploads the reference to R2 under `thumbnails/.../fal-source-*`, sends Fal a **presigned GET URL** (small JSON body, like Fal’s `image_url: "https://..."` examples), then deletes the staging object after the Fal call. Set `FAL_THUMBNAIL_DISABLE_R2_SOURCE_STAGING=1` to embed base64 `data:` URIs instead. `FAL_THUMBNAIL_SOURCE_READ_URL_SEC` (default `7200`) controls presigned URL lifetime.

**Optional Gemini prompt rewrite:** Set `THUMBNAIL_GEMINI_ENRICH=1` and configure `GEMINI_API`. The route calls Gemini (default model `gemini-2.5-flash`, override with `THUMBNAIL_GEMINI_MODEL`) once per request to turn creator notes into a tighter visual brief for Schnell/FLUX; rule-based domain hints still use the **original** truncated text for keyword matching. If Gemini fails or is disabled, generation falls back to the non-LLM path only.
