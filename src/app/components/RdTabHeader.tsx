'use client'

import { Clapperboard, RadioTower, TrendingUp } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type RdSubTab = 'going-live' | 'trending-vids' | 'viral-clip-gen'

type RdLabels = {
  goingLive: string
  trendingVids: string
  viralClipGen: string
}

const SUB_TAB_META: Record<RdSubTab, { icon: typeof Clapperboard; shortLabel: string }> = {
  'viral-clip-gen': { icon: Clapperboard, shortLabel: 'Viral' },
  'trending-vids': { icon: TrendingUp, shortLabel: 'Trends' },
  'going-live': { icon: RadioTower, shortLabel: 'Live' },
}

export function rdTabTitle(subTab: RdSubTab, labels: RdLabels): string {
  switch (subTab) {
    case 'viral-clip-gen':
      return labels.viralClipGen
    case 'trending-vids':
      return labels.trendingVids
    case 'going-live':
      return labels.goingLive
  }
}

interface Props {
  activeSubTab: RdSubTab
  labels: RdLabels
  pickToolLabel: string
  darkMode: boolean
  tabListClasses: string
  tabTriggerClasses: string
}

export default function RdTabHeader({
  activeSubTab,
  labels,
  pickToolLabel,
  darkMode,
  tabListClasses,
  tabTriggerClasses,
}: Props) {
  const title = rdTabTitle(activeSubTab, labels)

  const labelFor = (id: RdSubTab) => {
    switch (id) {
      case 'viral-clip-gen':
        return labels.viralClipGen
      case 'trending-vids':
        return labels.trendingVids
      case 'going-live':
        return labels.goingLive
    }
  }

  return (
    <>
      <div className="flex flex-col items-center mb-4 text-center">
        <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
        <p className={`text-sm mt-1 ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'}`}>
          {pickToolLabel}
        </p>
      </div>
      <TabsList
        className={cn(
          'grid h-auto w-full max-w-3xl mx-auto grid-cols-3 mb-6 rounded-xl p-1',
          tabListClasses
        )}
      >
        {(Object.keys(SUB_TAB_META) as RdSubTab[]).map((id) => {
          const meta = SUB_TAB_META[id]
          const Icon = meta.icon
          return (
            <TabsTrigger
              key={id}
              value={id}
              className={cn(
                'flex items-center justify-center gap-1.5 text-xs sm:text-sm',
                tabTriggerClasses
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline truncate">{labelFor(id)}</span>
              <span className="sm:hidden">{meta.shortLabel}</span>
            </TabsTrigger>
          )
        })}
      </TabsList>
    </>
  )
}
