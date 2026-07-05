'use client'

import { useEffect } from 'react'
import type { CreateSubTab } from '@/app/components/CreateTabHeader'
import type { RdSubTab } from '@/app/components/RdTabHeader'

/** Redirect legacy tab query/hash names to current main + create sub-tabs. */
export function useLegacyTabRedirect(
  activeTab: string,
  setActiveTab: (tab: string) => void,
  setCreateSubTab: (sub: CreateSubTab) => void,
  setRndSubTab: (sub: RdSubTab) => void
) {
  useEffect(() => {
    const legacyTabMap: Record<string, { tab: string; sub?: CreateSubTab; rndSub?: RdSubTab }> = {
      'resource-hub': { tab: 'educate' },
      'tag-generator-free': { tab: 'create', sub: 'tags' },
      'thumbnail-generator': { tab: 'create', sub: 'thumbnail' },
      'background-remover': { tab: 'create', sub: 'background' },
      post4me: { tab: 'create', sub: 'post4me' },
      'clip-analyzer': { tab: 'analyze' },
      'clip-editor': { tab: 'rnd', rndSub: 'clip-editor' },
      'destiny-top-nest': { tab: 'rnd', rndSub: 'destiny-top-nest' },
      'new-tool': { tab: 'educate' },
    }

    const applyMapped = (key: string) => {
      const mapped = legacyTabMap[key]
      if (!mapped) return
      setActiveTab(mapped.tab)
      if (mapped.sub) setCreateSubTab(mapped.sub)
      if (mapped.rndSub) setRndSubTab(mapped.rndSub)
    }

    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (tabParam) applyMapped(tabParam)
    else applyMapped(activeTab)
  }, [activeTab, setActiveTab, setCreateSubTab, setRndSubTab])
}
