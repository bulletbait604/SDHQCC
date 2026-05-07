/**
 * Shotstack Edit API base URL.
 * @see https://shotstack.io/docs/api — POST/GET `.../edit/{version}/render`
 *
 * `SHOTSTACK_STAGE` selects the API segment (not the old `.../sandbox/...` host path):
 * - `stage`, `sandbox`, or unset: `https://api.shotstack.io/edit/stage` (typical dev keys)
 * - `v1`, `live`, `production`: `https://api.shotstack.io/edit/v1`
 */
export function resolveShotstackApiKey(): string | undefined {
  const raw = process.env.SHOTSTACK_API_KEY
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** Shown in the Clip Editor when `SHOTSTACK_API_KEY` is unset in production (e.g. Vercel). */
export const SHOTSTACK_KEY_MISSING_USER_MESSAGE =
  'Shotstack is not configured on this server. In Vercel: Project → Settings → Environment Variables → add SHOTSTACK_API_KEY for Production, save, then Redeploy.'

export function shotstackEditApiRoot(): string {
  const raw = (process.env.SHOTSTACK_STAGE || 'stage').trim().toLowerCase()
  const version = ['v1', 'live', 'production'].includes(raw) ? 'v1' : 'stage'
  return `https://api.shotstack.io/edit/${version}`
}
