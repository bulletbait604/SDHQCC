/**
 * Normalize Kick Public API user rows (OAuth user:read → GET /public/v1/users).
 * Official schema includes user_id, name, profile_picture, email; extra fields may appear over time.
 */

export type NormalizedKickUser = {
  id: number | string
  /** Canonical login slug (lowercase), used as DB key and session name */
  username: string
  /** Display name from Kick (may differ from username) */
  display_name: string
  profile_image_url?: string
  email?: string
}

/** Pick primitive extras from raw Kick payload for Mongo `kickOAuth.extras` (extend keys as API grows). */
const EXTRA_KEYS = ['bio', 'country', 'city', 'state'] as const

export function normalizeKickUserRow(kickUser: Record<string, unknown>): NormalizedKickUser | null {
  const userId = kickUser.user_id ?? kickUser.id
  if (userId == null) return null

  const profilePic =
    (typeof kickUser.profile_picture === 'string' && kickUser.profile_picture) ||
    (typeof kickUser.profile_picture_url === 'string' && kickUser.profile_picture_url) ||
    (typeof kickUser.avatar === 'string' && kickUser.avatar) ||
    undefined

  const displayFromName = typeof kickUser.name === 'string' ? kickUser.name : ''
  const loginFromApi =
    (typeof kickUser.username === 'string' && kickUser.username) ||
    (typeof kickUser.slug === 'string' && kickUser.slug) ||
    displayFromName

  const username = String(loginFromApi).replace(/^@/, '').toLowerCase()
  if (!username) return null

  const display_name =
    (displayFromName && displayFromName.trim()) ||
    (typeof kickUser.username === 'string' ? kickUser.username : username)

  const email = typeof kickUser.email === 'string' ? kickUser.email : undefined

  return {
    id: userId as number | string,
    username,
    display_name,
    profile_image_url: profilePic,
    email,
  }
}

export function kickOAuthExtrasFromRow(kickUser: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of EXTRA_KEYS) {
    const v = kickUser[k]
    if (typeof v === 'string' && v.trim()) out[k] = v
  }
  return out
}
