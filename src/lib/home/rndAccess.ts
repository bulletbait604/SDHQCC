import { isSiteOwner } from '@/lib/home/ownerIdentity'
import type { Role } from '@/lib/home/roles'

const OWNER_ONLY_RND_TABS = [
  'viral-clip-gen',
  'trending-vids',
  'going-live',
  'tradebot',
  'narrate-me',
  'viruses-port-scanner',
] as const

/** Full R&D lab (Narrate Me, TradeBot, Viruses, …): site owner only. */
export function canAccessRnd(_userRole: Role, username: string | null | undefined): boolean {
  return isSiteOwner(username)
}

/** R&D main tab is visible to any Kick-signed-in user (Vi-Guys GW Map). */
export function canSeeRndTab(username: string | null | undefined): boolean {
  return Boolean(username && username.trim())
}

/** Non-owners may only open Vi-Guys GW Map inside R&D. */
export function canAccessRdSubTab(subTab: string, username: string | null | undefined): boolean {
  if (subTab === 'vi-guys-gw-map') return canSeeRndTab(username)
  if ((OWNER_ONLY_RND_TABS as readonly string[]).includes(subTab)) {
    return canAccessRnd('free', username)
  }
  return false
}
