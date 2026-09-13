import { isSiteOwner } from '@/lib/home/ownerIdentity'
import type { Role } from '@/lib/home/roles'

/** R&D tab and tools (including Viruses Port Scanner): site owner only (Bulletbait). */
export function canAccessRnd(_userRole: Role, username: string | null | undefined): boolean {
  return isSiteOwner(username)
}
