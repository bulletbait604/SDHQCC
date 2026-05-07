/**
 * Shotstack Edit API base URL.
 * @see https://shotstack.io/docs/api — POST/GET `.../edit/{version}/render`
 *
 * `SHOTSTACK_STAGE` selects the API segment (not the old `.../sandbox/...` host path):
 * - `stage`, `sandbox`, or unset: `https://api.shotstack.io/edit/stage` (typical dev keys)
 * - `v1`, `live`, `production`: `https://api.shotstack.io/edit/v1`
 */
export type ShotstackEditApiVersion = 'stage' | 'v1'

export function shotstackEditApiVersion(): ShotstackEditApiVersion {
  const raw = (process.env.SHOTSTACK_STAGE || 'stage').trim().toLowerCase()
  return ['v1', 'live', 'production'].includes(raw) ? 'v1' : 'stage'
}

export function shotstackEditApiRoot(): string {
  return `https://api.shotstack.io/edit/${shotstackEditApiVersion()}`
}

/** Appended to API error text when Shotstack returns 401/403 (wrong key vs URL segment). */
export function shotstackAuthEnvironmentHint(httpStatus: number): string {
  if (httpStatus !== 401 && httpStatus !== 403) return ''
  const v = shotstackEditApiVersion()
  if (v === 'stage') {
    return ' Shotstack returned 403/401 on /edit/stage/ — production keys must use /edit/v1/: set SHOTSTACK_STAGE=v1 in Vercel (Environment → Production), save, redeploy.'
  }
  return ' Shotstack returned 403/401 on /edit/v1/ — sandbox/trial keys only work on stage: remove SHOTSTACK_STAGE or set SHOTSTACK_STAGE=stage, save, redeploy.'
}

/** Best-effort message from Shotstack non-2xx JSON (shape varies by error type). */
export function shotstackSubmitUserMessage(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return 'Shotstack rejected the render request. If your key is sandbox, leave SHOTSTACK_STAGE unset or use stage; production keys need v1.'
  }
  const d = data as Record<string, unknown>
  const parts: string[] = []
  if (typeof d.message === 'string' && d.message.trim()) parts.push(d.message.trim())
  if (typeof d.error === 'string' && d.error.trim()) parts.push(d.error.trim())
  if (Array.isArray(d.errors)) {
    for (const item of d.errors.slice(0, 6)) {
      if (typeof item === 'string' && item.trim()) {
        parts.push(item.trim())
        continue
      }
      if (item && typeof item === 'object') {
        const e = item as Record<string, unknown>
        const bit = [e.title, e.detail, e.message, e.description].find(
          (x) => typeof x === 'string' && String(x).trim()
        ) as string | undefined
        if (bit) parts.push(bit.trim())
      }
    }
  }
  const seen = new Set<string>()
  const unique: string[] = []
  for (const p of parts) {
    if (!seen.has(p)) {
      seen.add(p)
      unique.push(p)
    }
  }
  const merged = unique.join(' — ')
  if (merged) return merged.length > 500 ? `${merged.slice(0, 497)}…` : merged
  return 'Shotstack rejected the render request. Check API key, SHOTSTACK_STAGE (stage vs v1), and that the source video URL is publicly reachable by Shotstack.'
}
