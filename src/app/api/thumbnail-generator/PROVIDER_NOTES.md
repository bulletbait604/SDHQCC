# Thumbnail generator

**Default pipeline:** Text/image prompts → Gemini research (`gemini-3.1-flash-lite`) with cached algorithm virality scoring → **Gemini 2.5 Flash Image** paints with required sticker pack. **Clip uploads** skip research rewrite and use the viral sticker-pack + cached algorithm path (same as Thumbnail 2.0): analyze with `gemini-3.1-flash-lite`, paint overlays only on the captured frame.

| Step | Model | Env |
|------|--------|-----|
| Prompt research | `gemini-2.5-flash` | `GEMINI_API` (optional `THUMBNAIL_GEMINI_MODEL`) |
| Text-only paint | `gemini-2.5-flash-image` | `GEMINI_API` (optional `THUMBNAIL_GEMINI_IMAGE_MODEL`) |
| Reference + prompt | same image model | same |

**Required env:**

- `GEMINI_API` — Google AI Studio key
- `THUMBNAIL_GENERATOR_BACKEND=gemini` (default in code; set explicitly in Vercel if you previously used `fal`)

**Optional env:**

- `THUMBNAIL_ALLOW_BRAND_LOGOS=1` — platform/game logo badges in prompt
- `THUMBNAIL_GEMINI_SPELLCHECK=0` — disable typo fallback when research fails
- `THUMBNAIL_GEMINI_THINKING_LEVEL=LOW|MEDIUM|HIGH` — research pass only

**Legacy Fal paint stack:** `THUMBNAIL_GENERATOR_BACKEND=fal` + `FAL_KEY` uses Nano Banana Pro instead of Gemini image models.
