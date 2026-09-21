'use client'

import { TrendingUp } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type RdSubTab = 'trending-vids'

type RdLabels = {
  trendingVids: string
}

const SUB_TAB_META: Record<RdSubTab, { icon: typeof TrendingUp; shortLabel: string }> = {
  'trending-vids': { icon: TrendingUp, shortLabel: 'Trends' },
}

export const ALL_RD_SUBS = Object.keys(SUB_TAB_META) as RdSubTab[]

export function rdTabTitle(subTab: RdSubTab, labels: RdLabels): string {
  return labels.trendingVids
}

interface Props {
  activeSubTab: RdSubTab
  labels: RdLabels
  pickToolLabel: string
  darkMode: boolean
  tabListClasses: string
  tabTriggerClasses: string
  visibleTabs?: RdSubTab[]
}

export default function RdTabHeader({
  activeSubTab,
  labels,
  pickToolLabel,
  darkMode,
  tabListClasses,
  tabTriggerClasses,
  visibleTabs,
}: Props) {
  const title = rdTabTitle(activeSubTab, labels)
  const tabs = (visibleTabs?.length ? visibleTabs : ALL_RD_SUBS).filter((id) => id in SUB_TAB_META)
  const count = tabs.length

  return (
    <>
      <div className="mb-5 flex flex-col items-center text-center">
        <h3 className={`text-3xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </h3>
        <p className={`mt-1 text-sm ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'}`}>
          {pickToolLabel}
        </p>
      </div>
      {count > 1 && (
        <TabsList
          className={cn(
            'mx-auto mb-6 grid h-auto w-full max-w-md rounded-2xl p-1.5',
            'grid-cols-1',
            tabListClasses
          )}
        >
          {tabs.map((id) => {
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
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden truncate sm:inline">{rdTabTitle(id, labels)}</span>
                <span className="sm:hidden">{meta.shortLabel}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>
      )}
    </>
  )
}
