# Thumbnail generator

**Default pipeline:** Gemini 3.5 Flash researches the prompt → Fal **Nano Banana Pro** paints the image.

| Step | Model | Env |
|------|--------|-----|
| Prompt research | `gemini-3.5-flash` | `GEMINI_API` (optional `THUMBNAIL_GEMINI_MODEL`) |
| Text-only paint | `fal-ai/nano-banana-pro` | `FAL_KEY` + `THUMBNAIL_GENERATOR_BACKEND=fal` |
| Reference + prompt | `fal-ai/nano-banana-pro/edit` | same |

**Optional env (only if you need to override defaults):**

- `FAL_THUMBNAIL_NANO_PRO_RESOLUTION=1K|2K|4K` (default `1K`)
- `THUMBNAIL_ALLOW_BRAND_LOGOS=1` — platform/game logo badges in prompt
- `THUMBNAIL_GEMINI_SPELLCHECK=0` — disable typo fallback when research fails
- `FAL_THUMBNAIL_IMAGE_STACK=flux` — legacy FLUX.2 Flash paint stack instead of Pro

**Legacy:** `THUMBNAIL_GENERATOR_BACKEND=gemini` uses Gemini image models directly (no Fal).

**Auth:** `GEMINI_API`, `FAL_KEY` (or `FAL_API_KEY` / `SCHNELL_API_KEY`).
