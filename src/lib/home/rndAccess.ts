import { isSiteOwner } from '@/lib/home/ownerIdentity'
import type { Role } from '@/lib/home/roles'

/** R&D tools the owner can grant one-by-one. Vi-Guys GW Map lives under User APPs. */
export const GRANTABLE_RND_TABS = [
  'narrate-me',
  'viral-clip-gen',
  'trending-vids',
  'going-live',
  'tradebot',
  'viruses-port-scanner',
] as const

export type GrantableRndTab = (typeof GRANTABLE_RND_TABS)[number]

export function isGrantableRndTab(tab: string): tab is GrantableRndTab {
  return (GRANTABLE_RND_TABS as readonly string[]).includes(tab)
}

export function sanitizeRndTabs(raw: unknown): GrantableRndTab[] {
  if (!Array.isArray(raw)) return []
  const out: GrantableRndTab[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const id = item.trim()
    if (!isGrantableRndTab(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** Full R&D lab: site owner, or anyone the owner granted at least one R&D tool. */
export function canAccessRnd(
  _userRole: Role,
  username: string | null | undefined,
  grantedTabs: readonly string[] = []
): boolean {
  return canSeeRndTab(username, grantedTabs)
}

export function canSeeRndTab(
  username: string | null | undefined,
  grantedTabs: readonly string[] = []
): boolean {
  if (isSiteOwner(username)) return true
  if (!username || !username.trim()) return false
  return sanitizeRndTabs(grantedTabs).length > 0
}

export function canAccessRdSubTab(
  subTab: string,
  username: string | null | undefined,
  grantedTabs: readonly string[] = []
): boolean {
  if (!isGrantableRndTab(subTab)) return false
  if (isSiteOwner(username)) return true
  if (!username || !username.trim()) return false
  return sanitizeRndTabs(grantedTabs).includes(subTab)
}
