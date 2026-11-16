import clientPromise from '@/lib/mongodb'
import { twitchClientId } from './oauth'

const COLLECTION = 'twitch_tokens'

type StoredToken = {
  _id: string
  accessToken: string
  refreshToken: string
  expiresAt: string
  scope: string
}

function clientSecret(): string | null {
  const value = process.env.TWITCH_CLIENT_SECRET?.trim()
  return value || null
}

async function collection() {
  const client = await clientPromise
  return client.db('sdhq').collection<StoredToken>(COLLECTION)
}

export async function saveTwitchTokens(input: {
  twitchId: string
  accessToken: string
  refreshToken: string
  expiresIn: number
  scope: string
}): Promise<void> {
  const expiresAt = new Date(Date.now() + Math.max(30, input.expiresIn) * 1000).toISOString()
  await (await collection()).updateOne(
    { _id: input.twitchId },
    {
      $set: {
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        expiresAt,
        scope: input.scope,
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true }
  )
}

async function refresh(refreshToken: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
  scope: string
} | null> {
  const clientId = twitchClientId()
  const secret = clientSecret()
  if (!clientId || !secret) return null
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: secret,
    }),
  })
  if (!response.ok) return null
  const body = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string | string[]
  }
  if (!body.access_token) return null
  const scope = Array.isArray(body.scope) ? body.scope.join(' ') : body.scope || ''
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token || refreshToken,
    expiresIn: typeof body.expires_in === 'number' ? body.expires_in : 3600,
    scope,
  }
}

/** Server-only. Refreshes the Helix token when it is near expiry. */
export async function getTwitchAccessToken(twitchId: string): Promise<string | null> {
  const col = await collection()
  const row = await col.findOne({ _id: twitchId })
  if (!row?.accessToken || !row.refreshToken) return null
  const expires = Date.parse(row.expiresAt)
  if (Number.isFinite(expires) && expires - Date.now() > 60_000) return row.accessToken
  const next = await refresh(row.refreshToken)
  if (!next) return null
  await saveTwitchTokens({ twitchId, ...next })
  return next.accessToken
}
