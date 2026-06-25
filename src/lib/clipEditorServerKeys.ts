/**
 * Clip Editor: resolve provider secrets from env (supports user-defined names).
 */

export function resolveDeepSeekApiKey(): string | undefined {
  const key = (process.env.DEEPSEEK_API_KEY || '').trim() || undefined
  return key
}

export function resolveDeepgramApiKey(): string | undefined {
  const key =
    (process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_API || '').trim() || undefined
  return key
}

export function resolveRunwayApiSecret(): string | undefined {
  const key =
    (process.env.RUNWAY_API || process.env.RUNWAYML_API_SECRET || '').trim() || undefined
  return key
}

export function resolveVizardApiKey(): string | undefined {
  const key =
    (process.env.VIZARDAI_API_KEY || process.env.VIZARD_API_KEY || '').trim() || undefined
  return key
}

const SHOTSTACK_SECRET_ENV_NAMES = ['SHOTSTACK_API_KEY', 'SHOTSTACK_API', 'SHOTSTACK_KEY'] as const

function readEnvTrim(name: string): string | undefined {
  const raw = process.env[name]
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Shotstack developer key. Tries common names so deployments can keep older env naming.
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

/** Short checklist for Shotstack + Vizard two-pass setup (Vercel / env). */
export function clipEditorTwoPassConfigurationHints(): string[] {
  return [
    'Shotstack 401/403 on render: production keys must use SHOTSTACK_STAGE=v1 (or live/production). Sandbox/trial keys use stage — unset SHOTSTACK_STAGE or set SHOTSTACK_STAGE=stage, then redeploy.',
    'Vizard cannot fetch Shotstack URLs (4008 / download failed): keep the default CLIP_EDITOR_VIZARD_REFINE_REHOST_SHOTSTACK (on) so the server copies the render to R2 and sends Vizard a long-lived HTTPS URL. Set to false only if Vizard can reach Shotstack output URLs directly.',
    'Vizard API: set VIZARDAI_API_KEY (or VIZARD_API_KEY) for the same Vercel environment and redeploy.',
  ]
}

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
