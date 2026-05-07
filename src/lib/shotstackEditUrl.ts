/**
 * Shotstack Edit API base URL.
 * @see https://shotstack.io/docs/api — POST/GET `.../edit/{version}/render`
 *
 * `SHOTSTACK_STAGE` selects the API segment (not the old `.../sandbox/...` host path):
 * - `stage`, `sandbox`, or unset: `https://api.shotstack.io/edit/stage` (typical dev keys)
 * - `v1`, `live`, `production`: `https://api.shotstack.io/edit/v1`
 */
export function shotstackEditApiRoot(): string {
  const raw = (process.env.SHOTSTACK_STAGE || 'stage').trim().toLowerCase()
  const version = ['v1', 'live', 'production'].includes(raw) ? 'v1' : 'stage'
  return `https://api.shotstack.io/edit/${version}`
}
