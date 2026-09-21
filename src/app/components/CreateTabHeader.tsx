'use client'

import { Hash, Image as ImageIcon, Scissors, Send } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type CreateSubTab = 'thumbnail' | 'tags' | 'background' | 'post4me'

const SUB_TAB_META: Record<
  CreateSubTab,
  { icon: typeof ImageIcon; shortLabel: string }
> = {
  thumbnail: { icon: ImageIcon, shortLabel: 'Thumbnail' },
  tags: { icon: Hash, shortLabel: 'Tags' },
  background: { icon: Scissors, shortLabel: 'Background' },
  post4me: { icon: Send, shortLabel: 'Post4Me' },
}

export function createTabTitle(
  subTab: CreateSubTab,
  labels: { thumbnail: string; tags: string; background: string; post4me: string }
): string {
  switch (subTab) {
    case 'thumbnail':
      return labels.thumbnail
    case 'tags':
      return labels.tags
    case 'background':
      return labels.background
    case 'post4me':
      return labels.post4me
  }
}

interface Props {
  activeSubTab: CreateSubTab
  labels: { thumbnail: string; tags: string; background: string; post4me: string }
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
      <div className="mb-5 flex flex-col items-center text-center">
        <h3 className={`text-3xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
        <p className={`mt-1 text-sm ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'}`}>
          {pickToolLabel}
        </p>
      </div>
      <TabsList className={cn('mx-auto mb-6 grid w-full max-w-3xl grid-cols-2 rounded-2xl p-1.5 sm:grid-cols-4', tabListClasses)}>
        {(Object.keys(SUB_TAB_META) as CreateSubTab[]).map((id) => {
          const meta = SUB_TAB_META[id]
          const Icon = meta.icon
          const label =
            id === 'thumbnail'
              ? labels.thumbnail
              : id === 'tags'
                ? labels.tags
                : id === 'post4me'
                  ? labels.post4me
                  : labels.background
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
