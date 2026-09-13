import { ADMIN_USERNAMES, OWNER_USERNAMES, TAB_PERMISSIONS, type Role } from '@/lib/home/roles'

export function normalizeKickUsername(username: string): string {
  return username.replace(/^@/, '').toLowerCase().trim()
}

/** True only for allowlisted site owners (currently Bulletbait604). */
export function isSiteOwner(username: string | null | undefined): boolean {
  if (!username) return false
  const normalized = normalizeKickUsername(username)
  return OWNER_USERNAMES.some((o) => normalizeKickUsername(o) === normalized)
}

/** Hardcoded Kick admins (currently mrv1rus). Not R&D unless the owner grants tools. */
export function isAllowlistedAdmin(username: string | null | undefined): boolean {
  if (!username) return false
  const normalized = normalizeKickUsername(username)
  return ADMIN_USERNAMES.some((a) => normalizeKickUsername(a) === normalized)
}

/**
 * Owner role in Mongo/JWT is reserved for the site owner account.
 * Allowlisted admins stay admin even if Mongo still says free.
 */
export function resolveSiteRole(username: string, role: Role | undefined): Role {
  if (isSiteOwner(username)) return 'owner'
  if (isAllowlistedAdmin(username)) return 'admin'
  if (role === 'owner') return 'admin'
  return role || 'free'
}

export function capOwnerRole(username: string, role: Role): Role {
  return resolveSiteRole(username, role)
}

/** Tab access — User APPs (including Vi-Guys) for signed-in users; R&D tools by owner grant. */
export function hasTabAccessForUser(
  userRole: Role,
  tabId: string,
  username: string | null | undefined,
  grantedRndTabs: readonly string[] = []
): boolean {
  const signedIn = Boolean(username && username.trim())
  if (tabId === 'rnd') {
    if (isSiteOwner(username)) return true
    return signedIn && grantedRndTabs.some((id) => typeof id === 'string' && id.trim())
  }
  if (tabId === 'vi-guys-gw-map' || tabId === 'kick-clips' || tabId === 'user-apps') {
    return signedIn
  }
  if (
    tabId === 'viral-clip-gen' ||
    tabId === 'trending-vids' ||
    tabId === 'going-live' ||
    tabId === 'tradebot' ||
    tabId === 'narrate-me' ||
    tabId === 'viruses-port-scanner'
  ) {
    if (isSiteOwner(username)) return true
    return signedIn && grantedRndTabs.includes(tabId)
  }
  return TAB_PERMISSIONS[userRole]?.[tabId] ?? true
}
