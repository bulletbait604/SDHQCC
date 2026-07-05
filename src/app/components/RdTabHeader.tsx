'use client'

import { Bot, Film, Sparkles } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type RdSubTab = 'clip-editor' | 'tradebot' | 'destiny-top-nest'

const SUB_TAB_META: Record<RdSubTab, { icon: typeof Film; shortLabel: string }> = {
  'clip-editor': { icon: Film, shortLabel: 'Clip Editor' },
  tradebot: { icon: Bot, shortLabel: 'Tradebot' },
  'destiny-top-nest': { icon: Sparkles, shortLabel: 'Top Nest' },
}

export function rdTabTitle(
  subTab: RdSubTab,
  labels: { clipEditor: string; tradebot: string; destinyTopNest: string }
): string {
  switch (subTab) {
    case 'clip-editor':
      return labels.clipEditor
    case 'tradebot':
      return labels.tradebot
    case 'destiny-top-nest':
      return labels.destinyTopNest
  }
}

interface Props {
  activeSubTab: RdSubTab
  labels: { clipEditor: string; tradebot: string; destinyTopNest: string }
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
      case 'clip-editor':
        return labels.clipEditor
      case 'tradebot':
        return labels.tradebot
      case 'destiny-top-nest':
        return labels.destinyTopNest
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
        className={cn('grid w-full max-w-2xl mx-auto grid-cols-3 mb-6 rounded-xl p-1', tabListClasses)}
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
