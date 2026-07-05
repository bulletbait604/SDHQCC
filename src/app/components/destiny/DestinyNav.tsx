'use client'

import type { LucideIcon } from 'lucide-react'
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
import { destinyNavPrimary, destinyNavSecondary, getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

const PRIMARY: { id: DestinyTopNestTab; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Home', icon: LayoutDashboard },
  { id: 'leaderboards', label: 'Leaderboards', icon: Trophy },
  { id: 'profile', label: 'Profile', icon: User },
]

const EXPLORE: { id: DestinyTopNestTab; label: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { id: 'fireteam', label: 'Fireteam', icon: Users },
  { id: 'loadouts', label: 'Loadouts', icon: Shield },
  { id: 'builds', label: 'Builds', icon: Brain },
  { id: 'clans', label: 'Clan', icon: Building2 },
  { id: 'season', label: 'Season', icon: Gift },
  { id: 'admin', label: 'Admin', icon: ShieldAlert, adminOnly: true },
]

interface Props {
  activeTab: DestinyTopNestTab
  onTabChange: (tab: DestinyTopNestTab) => void
  darkMode: boolean
  showAdmin?: boolean
}

export default function DestinyNav({ activeTab, onTabChange, darkMode, showAdmin = true }: Props) {
  const t = getDestinyTheme(darkMode)
  const exploreTabs = EXPLORE.filter((tab) => !tab.adminOnly || showAdmin)
  const isPrimary = PRIMARY.some((p) => p.id === activeTab)

  return (
    <div className="space-y-4 mb-8">
      <nav
        className={cn(
          'grid grid-cols-3 gap-2 p-1.5 rounded-[1.25rem]',
          darkMode ? 'bg-white/[0.04] ring-1 ring-white/[0.06]' : 'bg-black/[0.04] ring-1 ring-black/[0.05]'
        )}
        aria-label="Main sections"
      >
        {PRIMARY.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={destinyNavPrimary(active, darkMode)}
            >
              <Icon className="w-4 h-4 shrink-0 opacity-80" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      <div>
        <p className={cn('text-[11px] font-medium uppercase tracking-wider mb-2 px-1', t.caption)}>Explore</p>
        <nav
          className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin"
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
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {!isPrimary && (
        <p className={cn('text-xs px-1', t.muted)}>
          Tip: use Home for Bungie sign-in and run sync.
        </p>
      )}
    </div>
  )
}
