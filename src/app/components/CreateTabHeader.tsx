'use client'

import { Hash, Image as ImageIcon, RectangleHorizontal, Scissors, Send, Smile } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type CreateSubTab = 'thumbnail' | 'tags' | 'background' | 'post4me' | 'banners' | 'emotes'

export interface CreateTabLabels {
  thumbnail: string
  tags: string
  background: string
  post4me: string
  banners: string
  emotes: string
}

const SUB_TAB_META: Record<
  CreateSubTab,
  { icon: typeof ImageIcon; shortLabel: string }
> = {
  thumbnail: { icon: ImageIcon, shortLabel: 'Thumbnail' },
  tags: { icon: Hash, shortLabel: 'Tags' },
  background: { icon: Scissors, shortLabel: 'Background' },
  post4me: { icon: Send, shortLabel: 'Post4Me' },
  banners: { icon: RectangleHorizontal, shortLabel: 'Banners' },
  emotes: { icon: Smile, shortLabel: 'Emotes' },
}

export function createTabTitle(subTab: CreateSubTab, labels: CreateTabLabels): string {
  return labels[subTab]
}

interface Props {
  activeSubTab: CreateSubTab
  labels: CreateTabLabels
  pickToolLabel: string
  darkMode: boolean
  tabListClasses: string
  tabTriggerClasses: string
}

export default function CreateTabHeader({
  activeSubTab,
  labels,
  pickToolLabel,
  darkMode,
  tabListClasses,
  tabTriggerClasses,
}: Props) {
  const title = createTabTitle(activeSubTab, labels)

  return (
    <>
      <div className="mb-3 flex flex-col items-center text-center">
        <h3 className={`text-2xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
        <p className={`mt-0.5 text-sm ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'}`}>
          {pickToolLabel}
        </p>
      </div>
      <TabsList className={cn('mx-auto mb-4 grid h-auto w-full max-w-5xl grid-cols-2 gap-1 rounded-2xl p-1.5 sm:grid-cols-3 lg:flex lg:flex-wrap lg:justify-center', tabListClasses)}>
        {(Object.keys(SUB_TAB_META) as CreateSubTab[]).map((id) => {
          const meta = SUB_TAB_META[id]
          const Icon = meta.icon
          const label = labels[id]
          return (
            <TabsTrigger
              key={id}
              value={id}
              className={cn(
                'flex h-auto min-h-10 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:text-sm',
                tabTriggerClasses
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline">{label}</span>
              <span className="lg:hidden">{meta.shortLabel}</span>
            </TabsTrigger>
          )
        })}
      </TabsList>
    </>
  )
}
