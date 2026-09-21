'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  OWNER_VIEW_AS_STORAGE_KEY,
  parseOwnerViewAs,
  type OwnerViewAs,
} from '@/lib/home/ownerViewAs'

export function useOwnerViewAs(isOwner: boolean) {
  const [viewAs, setViewAsState] = useState<OwnerViewAs>('owner')

  useEffect(() => {
    if (!isOwner) {
      setViewAsState('owner')
      return
    }
    try {
      setViewAsState(parseOwnerViewAs(sessionStorage.getItem(OWNER_VIEW_AS_STORAGE_KEY)))
    } catch {
      setViewAsState('owner')
    }
  }, [isOwner])

  const setViewAs = useCallback(
    (next: OwnerViewAs) => {
      const safe = isOwner ? parseOwnerViewAs(next) : 'owner'
      setViewAsState(safe)
      try {
        if (isOwner) sessionStorage.setItem(OWNER_VIEW_AS_STORAGE_KEY, safe)
        else sessionStorage.removeItem(OWNER_VIEW_AS_STORAGE_KEY)
      } catch {
        /* ignore quota / private mode */
      }
    },
    [isOwner]
  )

  return { viewAs: isOwner ? viewAs : 'owner', setViewAs }
}
