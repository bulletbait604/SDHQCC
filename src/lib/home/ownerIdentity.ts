import { OWNER_USERNAMES, TAB_PERMISSIONS, type Role } from '@/lib/home/roles'

export function normalizeKickUsername(username: string): string {
  return username.replace(/^@/, '').toLowerCase().trim()
}

/** True only for allowlisted site owners (currently Bulletbait604). */
export function isSiteOwner(username: string | null | undefined): boolean {
  if (!username) return false
  const normalized = normalizeKickUsername(username)
  return OWNER_USERNAMES.some((o) => normalizeKickUsername(o) === normalized)
}

/**
 * Owner role in Mongo/JWT is reserved for the site owner account.
 * Others with a stale `owner` row are treated as admin for access checks.
 */
export function capOwnerRole(username: string, role: Role): Role {
  if (role === 'owner' && !isSiteOwner(username)) {
    return 'admin'
  }
  return role
}

/** Tab access — clip-editor is gated on site owner, not Mongo role alone. */
export function hasTabAccessForUser(userRole: Role, tabId: string, username: string | null | undefined): boolean {
  if (tabId === 'clip-editor') {
    return isSiteOwner(username)
  }
  return TAB_PERMISSIONS[userRole]?.[tabId] ?? true
}
