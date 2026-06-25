# Thumbnail generator

**Default pipeline:** Gemini 2.5 Flash researches the prompt → **Gemini 2.5 Flash Image** paints the thumbnail. No Fal required.

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
