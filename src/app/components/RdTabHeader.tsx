'use client'

import { Bot, Film, ImageIcon, PanelsTopLeft, RadioTower } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type RdSubTab =
  | 'clip-editor'
  | 'robot-talk'
  | 'thumbnail-2'
  | 'panels-banners'
  | 'going-live'

type RdLabels = {
  clipEditor: string
  robotTalk: string
  thumbnail2: string
  panelsBanners: string
  goingLive: string
}

const SUB_TAB_META: Record<RdSubTab, { icon: typeof Film; shortLabel: string }> = {
  'clip-editor': { icon: Film, shortLabel: 'Clips' },
  'thumbnail-2': { icon: ImageIcon, shortLabel: 'Thumb 2' },
  'panels-banners': { icon: PanelsTopLeft, shortLabel: "P&B's" },
  'going-live': { icon: RadioTower, shortLabel: 'Live' },
  'robot-talk': { icon: Bot, shortLabel: 'RobotTalk' },
}

export function rdTabTitle(subTab: RdSubTab, labels: RdLabels): string {
  switch (subTab) {
    case 'clip-editor':
      return labels.clipEditor
    case 'thumbnail-2':
      return labels.thumbnail2
    case 'panels-banners':
      return labels.panelsBanners
    case 'going-live':
      return labels.goingLive
    case 'robot-talk':
      return labels.robotTalk
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
      case 'clip-editor':
        return labels.clipEditor
      case 'thumbnail-2':
        return labels.thumbnail2
      case 'panels-banners':
        return labels.panelsBanners
      case 'going-live':
        return labels.goingLive
      case 'robot-talk':
        return labels.robotTalk
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
          'grid h-auto w-full max-w-4xl mx-auto grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 mb-6 rounded-xl p-1',
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
