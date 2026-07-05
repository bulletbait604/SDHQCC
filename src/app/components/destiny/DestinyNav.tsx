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
import { destinyNavPrimary, destinyNavSecondary } from '@/app/components/destiny/destinyTheme'
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
  const exploreTabs = EXPLORE.filter((tab) => !tab.adminOnly || showAdmin)
  const navActiveTab = LEGACY_PROFILE_TABS.includes(activeTab) ? 'profile' : activeTab

  return (
    <div className="space-y-0 mb-4">
      <nav
        className={cn(
          'd2-tab-bar grid grid-cols-3 gap-0',
          darkMode ? 'bg-black/20' : 'bg-black/[0.03]'
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
              <Icon className={cn('w-5 h-5 shrink-0', active && 'text-[var(--tn-arc)] drop-shadow-[0_0_8px_var(--tn-arc-glow)]')} />
              <span className="uppercase tracking-[0.12em] text-[10px] sm:text-xs font-bold">{tab.label}</span>
            </button>
          )
        })}
      </nav>

      <nav className="d2-tab-bar flex gap-0 overflow-x-auto mt-0" aria-label="More sections">
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
              <Icon className={cn('w-4 h-4 shrink-0', active && 'text-[var(--tn-solar)]')} />
              {tab.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
