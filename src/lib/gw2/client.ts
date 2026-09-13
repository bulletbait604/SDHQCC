const GW2_API = 'https://api.guildwars2.com/v2'

export class Gw2ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'Gw2ApiError'
    this.status = status
  }
}

function messageFromGw2Body(text: string, status: number): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as { text?: unknown }
      if (typeof json.text === 'string' && json.text.trim()) return json.text.trim()
    } catch {
      /* use raw snippet */
    }
  }
  return trimmed.slice(0, 180) || `GW2 API ${status}`
}

function abortSignal(timeoutMs: number | undefined): AbortSignal | undefined {
  if (!timeoutMs || timeoutMs <= 0) return undefined
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }
  return undefined
}

export async function gw2Get<T>(path: string, key?: string | null, timeoutMs = 0): Promise<T> {
  const url = new URL(`${GW2_API}${path.startsWith('/') ? path : `/${path}`}`)
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (key) {
    headers.Authorization = `Bearer ${key}`
    if (!url.searchParams.has('access_token')) url.searchParams.set('access_token', key)
  }
  let res: Response
  try {
    res = await fetch(url, { headers, cache: 'no-store', signal: abortSignal(timeoutMs) })
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    if (name === 'AbortError' || name === 'TimeoutError') {
      throw new Gw2ApiError('GW2 API timed out', 504)
    }
    throw err
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Gw2ApiError(messageFromGw2Body(text, res.status), res.status)
  }
  return (await res.json()) as T
}

export async function gw2GetOk<T>(path: string, key?: string | null, timeoutMs = 0): Promise<T | null> {
  try {
    return await gw2Get<T>(path, key, timeoutMs)
  } catch (err) {
    if (err instanceof Gw2ApiError && (err.status === 404 || err.status === 403)) return null
    throw err
  }
}

export async function gw2GetSafe<T>(path: string, key?: string | null, timeoutMs = 0): Promise<T | null> {
  try {
    return await gw2Get<T>(path, key, timeoutMs)
  } catch {
    return null
  }
}

export function gw2AuthUserMessage(err: unknown): string {
  if (err instanceof Gw2ApiError && (err.status === 401 || err.status === 403)) {
    return 'GW2 rejected this ArenaNet API key. Paste a new key with account, characters, and progression scopes.'
  }
  if (err instanceof Gw2ApiError && err.status === 429) {
    return 'Guild Wars 2 is rate-limiting this key right now. Wait a moment and refresh.'
  }
  if (err instanceof Gw2ApiError && (err.status === 504 || err.status === 408)) {
    return 'Guild Wars 2 took too long to answer. The map still shows locations; retry progress in a moment.'
  }
  return 'Could not read account progress from this ArenaNet API key. The map still shows every location.'
}
