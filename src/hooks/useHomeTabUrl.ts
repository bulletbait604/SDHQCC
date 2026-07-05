'use client'

import { useEffect, useRef } from 'react'
import type { CreateSubTab } from '@/app/components/CreateTabHeader'
import type { RdSubTab } from '@/app/components/RdTabHeader'
import { parseHomeTabFromSearch, syncHomeTabToUrl } from '@/lib/home/tabUrl'

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

  const appliedFromUrl = useRef(false)
  const skipNextUrlSync = useRef(true)

  useEffect(() => {
    if (!ready || appliedFromUrl.current) return
    appliedFromUrl.current = true

    const parsed = parseHomeTabFromSearch(window.location.search)
    setActiveTab(parsed.tab)
    if (parsed.create) setCreateSubTab(parsed.create)
    if (parsed.rnd) setRndSubTab(parsed.rnd)
  }, [ready, setActiveTab, setCreateSubTab, setRndSubTab])

  useEffect(() => {
    if (!ready || !appliedFromUrl.current) return

    if (skipNextUrlSync.current) {
      skipNextUrlSync.current = false
      return
    }

    syncHomeTabToUrl({ tab: activeTab, create: createSubTab, rnd: rndSubTab })
  }, [ready, activeTab, createSubTab, rndSubTab])
}
