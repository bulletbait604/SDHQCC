'use client'

import { useEffect, useRef } from 'react'
import type { CreateSubTab } from '@/app/components/CreateTabHeader'
import type { RdSubTab } from '@/app/components/RdTabHeader'
import type { UserAppSubTab } from '@/app/components/UserAppsTabHeader'
import {
  clearHomeTabState,
  DEFAULT_CREATE_SUB,
  DEFAULT_HOME_TAB,
  DEFAULT_RND_SUB,
  DEFAULT_USER_APP,
  persistHomeTabState,
  resolveHomeTabState,
} from '@/lib/home/tabUrl'

/** Restore tabs from the URL on load and keep the URL in sync when tabs change (logged-in only). */
export function useHomeTabUrl(options: {
  ready: boolean
  /** When false (logged out), tab params are stripped and the URL stays at `/`. */
  enabled: boolean
  activeTab: string
  createSubTab: CreateSubTab
  rndSubTab: RdSubTab
  userAppSubTab: UserAppSubTab
  setActiveTab: (tab: string) => void
  setCreateSubTab: (sub: CreateSubTab) => void
  setRndSubTab: (sub: RdSubTab) => void
  setUserAppSubTab: (sub: UserAppSubTab) => void
}) {
  const {
    ready,
    enabled,
    activeTab,
    createSubTab,
    rndSubTab,
    userAppSubTab,
    setActiveTab,
    setCreateSubTab,
    setRndSubTab,
    setUserAppSubTab,
  } = options

  const restored = useRef(false)

  useEffect(() => {
    if (!ready) return

    if (!enabled) {
      restored.current = false
      clearHomeTabState()
      setActiveTab(DEFAULT_HOME_TAB)
      return
    }

    if (restored.current) return
    restored.current = true

    const resolved = resolveHomeTabState(window.location.search)
    setActiveTab(resolved.tab)
    if (resolved.create) setCreateSubTab(resolved.create)
    else if (resolved.tab === 'create') setCreateSubTab(DEFAULT_CREATE_SUB)
    if (resolved.rnd) setRndSubTab(resolved.rnd)
    else if (resolved.tab === 'rnd') setRndSubTab(DEFAULT_RND_SUB)
    if (resolved.apps) setUserAppSubTab(resolved.apps)
    else if (resolved.tab === 'kick-clips') setUserAppSubTab(DEFAULT_USER_APP)

    persistHomeTabState(resolved)
  }, [ready, enabled, setActiveTab, setCreateSubTab, setRndSubTab, setUserAppSubTab])

  useEffect(() => {
    if (!ready || !enabled || !restored.current) return

    persistHomeTabState({
      tab: activeTab,
      create: activeTab === 'create' ? createSubTab : undefined,
      rnd: activeTab === 'rnd' ? rndSubTab : undefined,
      apps: activeTab === 'kick-clips' ? userAppSubTab : undefined,
    })
  }, [ready, enabled, activeTab, createSubTab, rndSubTab, userAppSubTab])
}
