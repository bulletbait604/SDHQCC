import { OWNER_USERNAMES } from '@/lib/home/roles'
import { isSiteOwner, normalizeKickUsername } from '@/lib/home/ownerIdentity'

/**
 * Server-side owner allowlist.
 * Uses OWNER_USERNAMES env when set; otherwise falls back to code constant (bulletbait604).
 */
export function isAllowlistedOwner(username: string): boolean {
  const normalized = normalizeKickUsername(username)
  const envRaw = process.env.OWNER_USERNAMES || ''
  const envList = envRaw
    .split(',')
    .map((s) => normalizeKickUsername(s))
    .filter(Boolean)
  if (envList.length > 0) {
    return envList.includes(normalized)
  }
  return isSiteOwner(username) || OWNER_USERNAMES.some((o) => normalizeKickUsername(o) === normalized)
}
