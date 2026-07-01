'use client'

import { Bot, Film } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type RdSubTab = 'clip-editor' | 'tradebot'

const SUB_TAB_META: Record<RdSubTab, { icon: typeof Film; shortLabel: string }> = {
  'clip-editor': { icon: Film, shortLabel: 'Clip Editor' },
  tradebot: { icon: Bot, shortLabel: 'Tradebot' },
}

export function rdTabTitle(
  subTab: RdSubTab,
  labels: { clipEditor: string; tradebot: string }
): string {
  switch (subTab) {
    case 'clip-editor':
      return labels.clipEditor
    case 'tradebot':
      return labels.tradebot
  }
}

interface Props {
  activeSubTab: RdSubTab
  labels: { clipEditor: string; tradebot: string }
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

  return (
    <>
      <div className="flex flex-col items-center mb-4 text-center">
        <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
        <p className={`text-sm mt-1 ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'}`}>
          {pickToolLabel}
        </p>
      </div>
      <TabsList
        className={cn('grid w-full max-w-xl mx-auto grid-cols-2 mb-6 rounded-xl p-1', tabListClasses)}
      >
        {(Object.keys(SUB_TAB_META) as RdSubTab[]).map((id) => {
          const meta = SUB_TAB_META[id]
          const Icon = meta.icon
          const label = id === 'clip-editor' ? labels.clipEditor : labels.tradebot
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
              <span className="hidden sm:inline truncate">{label}</span>
              <span className="sm:hidden">{meta.shortLabel}</span>
            </TabsTrigger>
          )
        })}
      </TabsList>
    </>
  )
}
