'use client'

import { useEffect } from 'react'
import type { CreateSubTab } from '@/app/components/CreateTabHeader'

/** Redirect legacy tab query/hash names to current main + create sub-tabs. */
export function useLegacyTabRedirect(
  activeTab: string,
  setActiveTab: (tab: string) => void,
  setCreateSubTab: (sub: CreateSubTab) => void
) {
  useEffect(() => {
    const legacyTabMap: Record<string, { tab: string; sub?: CreateSubTab }> = {
      'resource-hub': { tab: 'educate' },
      'tag-generator-free': { tab: 'create', sub: 'tags' },
      'thumbnail-generator': { tab: 'create', sub: 'thumbnail' },
      'background-remover': { tab: 'create', sub: 'background' },
      'post4me': { tab: 'create', sub: 'post4me' },
      'clip-analyzer': { tab: 'analyze' },
      'new-tool': { tab: 'educate' },
    }
    const mapped = legacyTabMap[activeTab]
    if (mapped) {
      setActiveTab(mapped.tab)
      if (mapped.sub) setCreateSubTab(mapped.sub)
    }
  }, [activeTab, setActiveTab, setCreateSubTab])
}
