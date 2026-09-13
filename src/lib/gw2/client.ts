const GW2_API = 'https://api.guildwars2.com/v2'

export class Gw2ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'Gw2ApiError'
    this.status = status
  }
}

export async function gw2Get<T>(path: string, key?: string | null): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (key) headers.Authorization = `Bearer ${key}`
  const res = await fetch(`${GW2_API}${path}`, { headers, cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Gw2ApiError(text.slice(0, 180) || `GW2 API ${res.status}`, res.status)
  }
  return (await res.json()) as T
}

export async function gw2GetOk<T>(path: string, key?: string | null): Promise<T | null> {
  try {
    return await gw2Get<T>(path, key)
  } catch (err) {
    if (err instanceof Gw2ApiError && (err.status === 404 || err.status === 403)) return null
    throw err
  }
}
