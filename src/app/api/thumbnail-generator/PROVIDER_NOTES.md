# Thumbnail generator (Fal FLUX Schnell only)

Thumbnails are generated **only** via Fal:

- **No reference image:** `fal-ai/flux-1/schnell` (text-to-image)
- **With reference image:** `fal-ai/flux-1/schnell/redux` (image remix via `data:...;base64,...` URL)

**Auth:** `SCHNELL_API_KEY` or `FAL_KEY` (or `FAL_API_KEY`).

The previous Gemini path was removed. **Gemini is not used** for this route.

**Note:** Redux’s API does not take a separate text instruction field — for uploads, the model remixes the image. Use the text prompt for **text-only** generations.
