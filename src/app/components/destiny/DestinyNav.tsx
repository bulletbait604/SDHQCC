'use client'

import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Trophy,
  Users,
  User,
  Building2,
  Gift,
  ShieldAlert,
} from 'lucide-react'
import type { DestinyTopNestTab } from '@/lib/destiny/types'
import { destinyNavPrimary, destinyNavSecondary, getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

const PRIMARY: { id: DestinyTopNestTab; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Home', icon: LayoutDashboard },
  { id: 'leaderboards', label: 'Boards', icon: Trophy },
  { id: 'profile', label: 'Profile', icon: User },
]

const EXPLORE: { id: DestinyTopNestTab; label: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { id: 'fireteam', label: 'Team', icon: Users },
  { id: 'clans', label: 'Clan', icon: Building2 },
  { id: 'season', label: 'Season', icon: Gift },
  { id: 'admin', label: 'Admin', icon: ShieldAlert, adminOnly: true },
]

const LEGACY_PROFILE_TABS: DestinyTopNestTab[] = ['loadouts', 'builds']

interface Props {
  activeTab: DestinyTopNestTab
  onTabChange: (tab: DestinyTopNestTab) => void
  darkMode: boolean
  showAdmin?: boolean
}

export default function DestinyNav({ activeTab, onTabChange, darkMode, showAdmin = true }: Props) {
  const t = getDestinyTheme(darkMode)
  const exploreTabs = EXPLORE.filter((tab) => !tab.adminOnly || showAdmin)
  const navActiveTab = LEGACY_PROFILE_TABS.includes(activeTab) ? 'profile' : activeTab

  return (
    <div className="space-y-3 mb-6">
      <nav
        className={cn(
          'grid grid-cols-3 gap-2 p-2 rounded-2xl',
          darkMode ? 'bg-black/30 ring-1 ring-white/10 shadow-xl' : 'bg-white/60 ring-1 ring-black/5 shadow-lg'
        )}
        aria-label="Main sections"
      >
        {PRIMARY.map((tab) => {
          const Icon = tab.icon
          const active = navActiveTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={destinyNavPrimary(active, darkMode)}
            >
              <Icon className={cn('w-6 h-6 shrink-0', active && 'text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]')} />
              <span className="uppercase tracking-wide text-[10px] sm:text-xs">{tab.label}</span>
            </button>
          )
        })}
      </nav>

      <nav
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin"
        aria-label="More sections"
      >
        {exploreTabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={destinyNavSecondary(active, darkMode)}
            >
              <Icon className={cn('w-5 h-5 shrink-0', active && 'text-amber-300')} />
              {tab.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
