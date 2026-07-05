'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DestinyTopNestTab } from '@/lib/destiny/types'
import {
  isDestinyTopNestTab,
  resolveHomeTabState,
  syncDestinySubTabToUrl,
  writeStoredHomeTabState,
} from '@/lib/home/tabUrl'
import { getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import DestinyNav from '@/app/components/destiny/DestinyNav'
import OverviewPanel from '@/app/components/destiny/OverviewPanel'
import LeaderboardsPanel from '@/app/components/destiny/LeaderboardsPanel'
import FireteamPanel from '@/app/components/destiny/FireteamPanel'
import ProfilePanel from '@/app/components/destiny/ProfilePanel'
import LoadoutsPanel from '@/app/components/destiny/LoadoutsPanel'
import BuildIntelPanel from '@/app/components/destiny/BuildIntelPanel'
import ClansPanel from '@/app/components/destiny/ClansPanel'
import SeasonPanel from '@/app/components/destiny/SeasonPanel'
import AdminPanel from '@/app/components/destiny/AdminPanel'
import { cn } from '@/lib/utils'

interface Props {
  darkMode: boolean
  subtitleClasses: string
  title: string
  tagline: string
}

export default function DestinyTopNestTab({ darkMode, subtitleClasses, title, tagline }: Props) {
  const [activeTab, setActiveTab] = useState<DestinyTopNestTab>('overview')
  const theme = getDestinyTheme(darkMode)
  const destinyRestored = useRef(false)
  const skipDestinyUrlSync = useRef(true)

  useEffect(() => {
    if (destinyRestored.current) return
    destinyRestored.current = true

    const resolved = resolveHomeTabState(window.location.search)
    if (resolved.destiny && isDestinyTopNestTab(resolved.destiny)) {
      setActiveTab(resolved.destiny)
    }
  }, [])

  useEffect(() => {
    if (!destinyRestored.current) return
    if (skipDestinyUrlSync.current) {
      skipDestinyUrlSync.current = false
      return
    }
    syncDestinySubTabToUrl(activeTab)
    writeStoredHomeTabState({
      tab: 'rnd',
      rnd: 'destiny-top-nest',
      destiny: activeTab,
    })
  }, [activeTab])

  function renderPanel() {
    switch (activeTab) {
      case 'overview':
        return <OverviewPanel darkMode={darkMode} />
      case 'leaderboards':
        return <LeaderboardsPanel darkMode={darkMode} />
      case 'fireteam':
        return <FireteamPanel darkMode={darkMode} />
      case 'profile':
        return <ProfilePanel darkMode={darkMode} />
      case 'loadouts':
        return <LoadoutsPanel darkMode={darkMode} />
      case 'builds':
        return <BuildIntelPanel darkMode={darkMode} />
      case 'clans':
        return <ClansPanel darkMode={darkMode} />
      case 'season':
        return <SeasonPanel darkMode={darkMode} />
      case 'admin':
        return <AdminPanel darkMode={darkMode} />
    }
  }

  return (
    <div className={cn('rounded-[1.75rem] p-5 sm:p-8 -m-2 sm:-m-4', theme.shell)}>
      <header className="mb-8 max-w-2xl">
        <p className={cn('text-xs font-medium uppercase tracking-widest mb-2', theme.caption)}>DestinyTopNest</p>
        <h2 className={cn('text-2xl sm:text-[1.75rem] font-semibold tracking-tight leading-tight', theme.heading)}>
          {title}
        </h2>
        <p className={cn('text-sm mt-3 leading-relaxed', subtitleClasses, theme.muted)}>{tagline}</p>
      </header>

      <DestinyNav activeTab={activeTab} onTabChange={setActiveTab} darkMode={darkMode} />

      <div className="animate-in fade-in duration-300">{renderPanel()}</div>
    </div>
  )
}
