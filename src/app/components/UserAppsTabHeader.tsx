'use client'

import { MapPinned, Video } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type UserAppSubTab = 'vi-guys-gw-map' | 'kick-clips'

type UserAppLabels = {
  viGuysGwMap: string
  kickClipsApp: string
}

const SUB_TAB_META: Record<UserAppSubTab, { icon: typeof MapPinned; shortLabel: string }> = {
  'vi-guys-gw-map': { icon: MapPinned, shortLabel: 'Vi-Guys' },
  'kick-clips': { icon: Video, shortLabel: 'Clips' },
}

export const ALL_USER_APPS = Object.keys(SUB_TAB_META) as UserAppSubTab[]

export function userAppTitle(subTab: UserAppSubTab, labels: UserAppLabels): string {
  return subTab === 'vi-guys-gw-map' ? labels.viGuysGwMap : labels.kickClipsApp
}

interface Props {
  activeSubTab: UserAppSubTab
  labels: UserAppLabels
  pickToolLabel: string
  darkMode: boolean
  tabListClasses: string
  tabTriggerClasses: string
}

export default function UserAppsTabHeader({
  activeSubTab,
  labels,
  pickToolLabel,
  darkMode,
  tabListClasses,
  tabTriggerClasses,
}: Props) {
  const title = userAppTitle(activeSubTab, labels)

  return (
    <>
      <div className="flex flex-col items-center mb-4 text-center">
        <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
        <p className={`text-sm mt-1 ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'}`}>
          {pickToolLabel}
        </p>
      </div>
      <TabsList className={cn('grid w-full max-w-xl mx-auto grid-cols-2 mb-6 rounded-xl p-1', tabListClasses)}>
        {(Object.keys(SUB_TAB_META) as UserAppSubTab[]).map((id) => {
          const meta = SUB_TAB_META[id]
          const Icon = meta.icon
          return (
            <TabsTrigger
              key={id}
              value={id}
              className={cn('flex items-center justify-center gap-1.5 text-xs sm:text-sm', tabTriggerClasses)}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline truncate">{userAppTitle(id, labels)}</span>
              <span className="sm:hidden">{meta.shortLabel}</span>
            </TabsTrigger>
          )
        })}
      </TabsList>
    </>
  )
}
