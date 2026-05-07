/**
 * Clip Editor: resolve provider secrets from env (supports user-defined names).
 */

export function resolveOpenAiApiKey(): string | undefined {
  const key =
    (process.env.OPENAI_API_KEY || process.env.OPENAI_API || '').trim() || undefined
  return key
}

export function resolveRunwayApiSecret(): string | undefined {
  const key =
    (process.env.RUNWAYML_API_SECRET || process.env.RUNWAY_API || '').trim() || undefined
  return key
}

export function clipEditorOpenAiModel(): string {
  return (
    process.env.CLIP_EDITOR_OPENAI_MODEL ||
    process.env.OPENAI_CLIP_EDITOR_MODEL ||
    'gpt-5.4-mini'
  ).trim()
}

const SHOTSTACK_SECRET_ENV_NAMES = ['SHOTSTACK_API_KEY', 'SHOTSTACK_API', 'SHOTSTACK_KEY'] as const

function readEnvTrim(name: string): string | undefined {
  const raw = process.env[name]
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Shotstack developer key. Tries common names (same pattern as GEMINI_API / OPENAI_API in this repo).
 * Uses `process.env[name]` so the value is read at runtime (avoids rare build-time inlining issues).
 */
export function resolveShotstackApiKey(): string | undefined {
  for (const name of SHOTSTACK_SECRET_ENV_NAMES) {
    const v = readEnvTrim(name)
    if (v) return v
  }
  return undefined
}

/** Shown in the Clip Editor when no Shotstack key resolves. */
export const SHOTSTACK_KEY_MISSING_USER_MESSAGE =
  'Shotstack is not configured on this server. In Vercel: Settings → Environment Variables — add SHOTSTACK_API_KEY for Production (check the Production checkbox), save, then Redeploy. You can also use SHOTSTACK_API or SHOTSTACK_KEY as the variable name.'

/** Non-secret hints for Vercel logs / JSON when the key is missing (only on Vercel). */
export function shotstackKeyMissingEnvHint(): Record<string, unknown> | undefined {
  if (process.env.VERCEL !== '1') return undefined
  const definedButBlank: Record<string, boolean> = {}
  const presentNonBlank: Record<string, boolean> = {}
  for (const name of SHOTSTACK_SECRET_ENV_NAMES) {
    const raw = process.env[name]
    const isString = typeof raw === 'string'
    definedButBlank[name] = isString && raw.trim().length === 0
    presentNonBlank[name] = isString && raw.trim().length > 0
  }
  return {
    vercelEnv: process.env.VERCEL_ENV ?? null,
    definedButBlank,
    presentNonBlank,
  }
}
