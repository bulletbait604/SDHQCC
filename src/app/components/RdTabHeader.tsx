'use client'

import { Bot, Bug, Clapperboard, Mic, RadioTower, TrendingUp } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type RdSubTab =
  | 'going-live'
  | 'trending-vids'
  | 'viral-clip-gen'
  | 'tradebot'
  | 'narrate-me'
  | 'viruses-port-scanner'

type RdLabels = {
  goingLive: string
  trendingVids: string
  viralClipGen: string
  tradeBot: string
  narrateMe: string
  virusesPortScanner: string
}

const SUB_TAB_META: Record<RdSubTab, { icon: typeof Clapperboard; shortLabel: string }> = {
  'narrate-me': { icon: Mic, shortLabel: 'Narrate' },
  'viral-clip-gen': { icon: Clapperboard, shortLabel: 'Viral' },
  'trending-vids': { icon: TrendingUp, shortLabel: 'Trends' },
  'going-live': { icon: RadioTower, shortLabel: 'Live' },
  tradebot: { icon: Bot, shortLabel: 'Bot' },
  'viruses-port-scanner': { icon: Bug, shortLabel: 'Viruses' },
}

export const ALL_RD_SUBS = Object.keys(SUB_TAB_META) as RdSubTab[]

export function rdTabTitle(subTab: RdSubTab, labels: RdLabels): string {
  switch (subTab) {
    case 'viral-clip-gen':
      return labels.viralClipGen
    case 'trending-vids':
      return labels.trendingVids
    case 'going-live':
      return labels.goingLive
    case 'tradebot':
      return labels.tradeBot
    case 'narrate-me':
      return labels.narrateMe
    case 'viruses-port-scanner':
      return labels.virusesPortScanner
  }
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

  const labelFor = (id: RdSubTab) => rdTabTitle(id, labels)

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
          'grid h-auto w-full max-w-6xl mx-auto mb-6 rounded-xl p-1',
          count <= 1
            ? 'grid-cols-1 max-w-md'
            : count <= 3
              ? 'grid-cols-2 sm:grid-cols-3'
              : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
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
