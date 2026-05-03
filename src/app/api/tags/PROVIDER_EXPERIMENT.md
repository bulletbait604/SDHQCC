# Tag generator provider experiment (Fal / OpenRouter)

## Revert to Gemini-only (production default)

1. **Env:** unset `TAG_GENERATOR_BACKEND` or set `TAG_GENERATOR_BACKEND=gemini` on Vercel, then redeploy.
2. **Git:** restore prior behavior with  
   `git checkout main -- src/app/api/tags/route.ts src/lib/tagGeneratorPrompt.ts`  
   and remove this file if you want a clean tree (optional).

**Baseline:** `TAG_GENERATOR_BACKEND` defaults to **`gemini`**. Nothing changes until you set `fal`.

## Important: FLUX “Schnell” vs tag generation

**`fal-ai/flux/schnell` (FLUX.1 Schnell)** on Fal is **text-to-image**. It returns images, not JSON hashtag lists. It **cannot** replace Gemini for the tag generator’s job.

This experiment uses **Fal’s OpenRouter integration** (`openrouter/router`) — an **LLM** — with your Fal API key (`SCHNELL_API_KEY` or `FAL_KEY`). That matches what `/api/tags` needs (text → JSON array).

Pick any OpenRouter model id via `FAL_TAG_LLM_MODEL` (e.g. `google/gemini-2.5-flash` for parity, or a smaller Llama for speed/cost).

## Env reference

| Variable | Purpose |
|----------|---------|
| `TAG_GENERATOR_BACKEND` | `gemini` (default) or `fal` |
| `SCHNELL_API_KEY` | Fal API key (alias of Fal’s `FAL_KEY`) |
| `FAL_KEY` | Same as above if you prefer Fal’s documented name |
| `FAL_TAG_LLM_MODEL` | OpenRouter model id when `TAG_GENERATOR_BACKEND=fal` |

## Commit bookmark

After merging, record the commit hash here if you need a known-good revert point:

`git log -1 --oneline`
