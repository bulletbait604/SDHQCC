'use client'

import { useEffect, useRef } from 'react'
import type { CreateSubTab } from '@/app/components/CreateTabHeader'
import type { RdSubTab } from '@/app/components/RdTabHeader'
import { persistHomeTabState, resolveHomeTabState } from '@/lib/home/tabUrl'

/** Restore tabs from the URL on load and keep the URL in sync when tabs change. */
export function useHomeTabUrl(options: {
  ready: boolean
  activeTab: string
  createSubTab: CreateSubTab
  rndSubTab: RdSubTab
  setActiveTab: (tab: string) => void
  setCreateSubTab: (sub: CreateSubTab) => void
  setRndSubTab: (sub: RdSubTab) => void
}) {
  const {
    ready,
    activeTab,
    createSubTab,
    rndSubTab,
    setActiveTab,
    setCreateSubTab,
    setRndSubTab,
  } = options

  const restoredFromStorage = useRef(false)

  useEffect(() => {
    if (!ready || restoredFromStorage.current) return
    restoredFromStorage.current = true

    const resolved = resolveHomeTabState(window.location.search)
    setActiveTab(resolved.tab)
    if (resolved.create) setCreateSubTab(resolved.create)
    if (resolved.rnd) setRndSubTab(resolved.rnd)
    persistHomeTabState({
      tab: resolved.tab,
      create: resolved.create ?? createSubTab,
      rnd: resolved.rnd ?? rndSubTab,
    })
  }, [ready, setActiveTab, setCreateSubTab, setRndSubTab, createSubTab, rndSubTab])

  useEffect(() => {
    if (!ready || !restoredFromStorage.current) return
    persistHomeTabState({ tab: activeTab, create: createSubTab, rnd: rndSubTab })
  }, [ready, activeTab, createSubTab, rndSubTab])
}
