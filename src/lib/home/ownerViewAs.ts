import type { Role } from '@/lib/home/roles'

export type OwnerViewAs = 'owner' | 'free' | 'subscriber'

export const OWNER_VIEW_AS_STORAGE_KEY = 'sdhq-owner-view-as'

export const OWNER_VIEW_AS_OPTIONS: { id: OwnerViewAs; label: string }[] = [
  { id: 'owner', label: 'Owner' },
  { id: 'free', label: 'Regular' },
  { id: 'subscriber', label: 'Subscriber' },
]

export function parseOwnerViewAs(raw: string | null | undefined): OwnerViewAs {
  if (raw === 'free' || raw === 'subscriber' || raw === 'owner') return raw
  return 'owner'
}

export function applyOwnerViewAs({
  isOwner,
  viewAs,
  userRole,
  isAdmin,
  isSubscribed,
  isLifetimeMember,
}: {
  isOwner: boolean
  viewAs: OwnerViewAs
  userRole: Role
  isAdmin: boolean
  isSubscribed: boolean
  isLifetimeMember: boolean
}): {
  userRole: Role
  isOwner: boolean
  isAdmin: boolean
  isSubscribed: boolean
  isLifetimeMember: boolean
  previewing: boolean
} {
  if (!isOwner || viewAs === 'owner') {
    return {
      userRole,
      isOwner,
      isAdmin,
      isSubscribed,
      isLifetimeMember,
      previewing: false,
    }
  }

  if (viewAs === 'subscriber') {
    return {
      userRole: 'subscriber',
      isOwner: false,
      isAdmin: false,
      isSubscribed: true,
      isLifetimeMember: false,
      previewing: true,
    }
  }

  return {
    userRole: 'free',
    isOwner: false,
    isAdmin: false,
    isSubscribed: false,
    isLifetimeMember: false,
    previewing: true,
  }
}
