'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Trophy,
  Users,
  User,
  Shield,
  Brain,
  Building2,
  Gift,
  ShieldAlert,
} from 'lucide-react'
import type { DestinyTopNestTab } from '@/lib/destiny/types'
import { getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import OverviewPanel from '@/app/components/destiny/OverviewPanel'
import LeaderboardsPanel from '@/app/components/destiny/LeaderboardsPanel'
import FireteamPanel from '@/app/components/destiny/FireteamPanel'
import ProfilePanel from '@/app/components/destiny/ProfilePanel'
import LoadoutsPanel from '@/app/components/destiny/LoadoutsPanel'
import BuildIntelPanel from '@/app/components/destiny/BuildIntelPanel'
import ClansPanel from '@/app/components/destiny/ClansPanel'
import SeasonPanel from '@/app/components/destiny/SeasonPanel'
import AdminPanel from '@/app/components/destiny/AdminPanel'
import { StatusPill } from '@/app/components/destiny/DestinyUi'
import { cn } from '@/lib/utils'

const TABS: { id: DestinyTopNestTab; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'leaderboards', label: 'Leaderboards', icon: Trophy },
  { id: 'fireteam', label: 'Fireteam Finder', icon: Users },
  { id: 'profile', label: 'My Profile', icon: User },
  { id: 'loadouts', label: 'Loadouts', icon: Shield },
  { id: 'builds', label: 'Build Intelligence', icon: Brain },
  { id: 'clans', label: 'Clans', icon: Building2 },
  { id: 'season', label: 'Season Rewards', icon: Gift },
  { id: 'admin', label: 'Admin Review', icon: ShieldAlert, adminOnly: true },
]

interface Props {
  darkMode: boolean
  subtitleClasses: string
  title: string
  tagline: string
}

export default function DestinyTopNestTab({ darkMode, subtitleClasses, title, tagline }: Props) {
  const [activeTab, setActiveTab] = useState<DestinyTopNestTab>('overview')
  const [bungieStatus, setBungieStatus] = useState<string | null>(null)
  const theme = getDestinyTheme(darkMode)

  const checkBungie = useCallback(async () => {
    try {
      const res = await fetch('/api/destiny/bungie/status', { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        setBungieStatus(json.message)
      }
    } catch {
      setBungieStatus(null)
    }
  }, [])

  useEffect(() => {
    checkBungie()
  }, [checkBungie])

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
    <div className={cn('rounded-2xl p-4 sm:p-6 -m-2 sm:-m-4', theme.shell)}>
      <div className="mb-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-300 via-purple-300 to-sky-300 bg-clip-text text-transparent">
          {title}
        </h2>
        <p className={cn('text-sm mt-2 max-w-2xl mx-auto', subtitleClasses, theme.muted)}>{tagline}</p>
        {bungieStatus && (
          <div className="mt-3 flex justify-center">
            <StatusPill
              label={bungieStatus}
              tone={bungieStatus.includes('connected') ? 'green' : 'gold'}
            />
          </div>
        )}
      </div>

      <nav className="flex gap-1 overflow-x-auto pb-2 mb-6 scrollbar-thin">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap shrink-0 transition-colors border',
                active
                  ? 'bg-amber-500/20 text-amber-100 border-amber-500/40'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-gray-200'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {tab.label}
            </button>
          )
        })}
      </nav>

      {renderPanel()}
    </div>
  )
}
