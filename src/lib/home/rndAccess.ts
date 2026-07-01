import { isSiteOwner } from '@/lib/home/ownerIdentity'
import type { Role } from '@/lib/home/roles'

/** R&D tab and internal tools: site owner or admin role. */
export function canAccessRnd(userRole: Role, username: string | null | undefined): boolean {
  if (isSiteOwner(username)) return true
  return userRole === 'admin' || userRole === 'owner'
}
