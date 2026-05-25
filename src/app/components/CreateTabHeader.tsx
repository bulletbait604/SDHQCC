'use client'

import { Hash, Image as ImageIcon, Scissors } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'

export type CreateSubTab = 'thumbnail' | 'tags' | 'background'

const SUB_TAB_META: Record<
  CreateSubTab,
  { icon: typeof ImageIcon; shortLabel: string }
> = {
  thumbnail: { icon: ImageIcon, shortLabel: 'Thumbnail' },
  tags: { icon: Hash, shortLabel: 'Tags' },
  background: { icon: Scissors, shortLabel: 'Background' },
}

export function createTabTitle(
  subTab: CreateSubTab,
  labels: { thumbnail: string; tags: string; background: string }
): string {
  switch (subTab) {
    case 'thumbnail':
      return labels.thumbnail
    case 'tags':
      return labels.tags
    case 'background':
      return labels.background
  }
}

interface Props {
  activeSubTab: CreateSubTab
  labels: { thumbnail: string; tags: string; background: string }
  pickToolLabel: string
  darkMode: boolean
  tabTriggerActiveClasses: string
  tabTriggerInactiveClasses: string
}

export default function CreateTabHeader({
  activeSubTab,
  labels,
  pickToolLabel,
  darkMode,
  tabTriggerActiveClasses,
  tabTriggerInactiveClasses,
}: Props) {
  const title = createTabTitle(activeSubTab, labels)

  return (
    <>
      <div className="flex flex-col items-center mb-4 text-center">
        <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
        <p className={`text-sm mt-1 ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'}`}>
          {pickToolLabel}
        </p>
      </div>
      <TabsList
        className={`grid w-full max-w-2xl mx-auto grid-cols-3 mb-6 rounded-xl ${
          darkMode ? 'bg-sdhq-dark-800/80' : 'bg-cyan-50'
        }`}
      >
        {(Object.keys(SUB_TAB_META) as CreateSubTab[]).map((id) => {
          const meta = SUB_TAB_META[id]
          const Icon = meta.icon
          const label =
            id === 'thumbnail' ? labels.thumbnail : id === 'tags' ? labels.tags : labels.background
          return (
            <TabsTrigger
              key={id}
              value={id}
              className={`flex items-center justify-center gap-1.5 text-xs sm:text-sm data-[state=active]:${tabTriggerActiveClasses} data-[state=inactive]:${tabTriggerInactiveClasses}`}
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
