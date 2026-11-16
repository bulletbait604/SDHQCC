/** Twitch OAuth scopes this app requests. Email is not required for the Home cards. */
export const TWITCH_SCOPES = [
  'moderator:read:followers',
  'channel:read:subscriptions',
  'bits:read',
] as const

export function twitchClientId(): string | null {
  const value = process.env.TWITCH_CLIENT_ID?.trim()
  return value || null
}

export function twitchRedirectUri(origin: string): string {
  const explicit = process.env.NEXT_PUBLIC_TWITCH_REDIRECT_URI?.trim()
  if (explicit) return explicit
  return `${origin.replace(/\/$/, '')}/auth/twitch/callback`
}

export function buildTwitchAuthorizeUrl(input: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const url = new URL('https://id.twitch.tv/oauth2/authorize')
  url.searchParams.set('client_id', input.clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', TWITCH_SCOPES.join(' '))
  url.searchParams.set('state', input.state)
  return url.toString()
}

export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}
