# Thumbnail generator: Fal vs Gemini

## Revert to Gemini only

Set **`THUMBNAIL_GENERATOR_PROVIDER=gemini`** (or unset) and ensure **`GEMINI_API`** is set. Redeploy.

## Fal mode (`THUMBNAIL_GENERATOR_PROVIDER=fal`)

- **Text only:** `fal-ai/flux-1/schnell` (text-to-image) with the same composed prompt as before.
- **With reference image:** `fal-ai/flux-1/schnell/redux` with `image_url` as a `data:...;base64,...` URI. The official **Redux** input has **no** separate text field — the model remixes the image. Put important layout text in the prompt for **text-only** runs, or accept a visual remix when uploading.

**Auth:** `SCHNELL_API_KEY` or `FAL_KEY` (same as other Fal calls).

## Bookmark

Record your last known-good commit after deploy: `git log -1 --oneline`
