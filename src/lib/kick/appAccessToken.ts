type CachedToken = { token: string; expiresAt: number }

let cached: CachedToken | null = null

/**
 * Kick app access token (client credentials). Used for public channel reads
 * without asking every user to re-consent channel:read.
 */
export async function getKickAppAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token

  const clientId = process.env.NEXT_PUBLIC_KICK_CLIENT_ID?.trim()
  const clientSecret = process.env.KICK_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error('Kick app credentials are not configured')
  }

  const response = await fetch('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
    message?: string
  }

  if (!response.ok || !body.access_token) {
    throw new Error(body.message || body.error || `Kick app token failed (${response.status})`)
  }

  const ttlMs = Math.max(60, Number(body.expires_in) || 3600) * 1000
  cached = { token: body.access_token, expiresAt: Date.now() + ttlMs }
  return cached.token
}

export function clearKickAppAccessTokenCache() {
  cached = null
}
