'use client'

import { ChevronDown } from 'lucide-react'
import type { FeaturedActivity } from '@/lib/destiny/types'
import { activityIntel } from '@/lib/destiny/activityIntel'
import { ItemIcon } from '@/app/components/destiny/DestinyUi'
import { cn } from '@/lib/utils'

function IntelBox({
  activity,
  kind,
}: {
  activity: FeaturedActivity
  kind: 'raid' | 'dungeon'
}) {
  const intel = activityIntel(activity)

  return (
    <details className="d2-wiki-box group">
      <summary className="d2-wiki-box-summary list-none cursor-pointer">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {activity.iconUrl ? (
            <ItemIcon iconUrl={activity.iconUrl} name={activity.name} size={44} />
          ) : (
            <div className="d2-item-thumb d2-rarity-legendary w-11 h-11 rounded-sm shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="d2-wiki-box-title truncate">{activity.name}</p>
            <p className="d2-wiki-box-meta">
              {kind === 'raid' ? 'Raid' : 'Dungeon'} · {intel.difficulty}
              {intel.resetsIn ? ` · ${intel.resetsIn}` : ''}
            </p>
          </div>
        </div>
        <ChevronDown className="d2-wiki-box-chevron w-4 h-4 shrink-0 text-white/40 group-open:rotate-180 transition-transform" />
      </summary>
      <div className="d2-wiki-box-body">
        <p className="d2-wiki-box-summary-text">{intel.summary}</p>
        <ul className="d2-wiki-box-tips">
          {intel.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>
    </details>
  )
}

/** Destinypedia-style collapsible activity intel panels. */
export default function ActivityIntelAccordion({
  raids,
  dungeons,
}: {
  raids: FeaturedActivity[]
  dungeons: FeaturedActivity[]
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-2">
        <p className="d2-panel-header-title text-[10px] mb-2">Featured raids</p>
        {raids.map((r) => (
          <IntelBox key={r.name} activity={r} kind="raid" />
        ))}
      </div>
      <div className="space-y-2">
        <p className="d2-panel-header-title text-[10px] mb-2">Featured dungeons</p>
        {dungeons.map((d) => (
          <IntelBox key={d.name} activity={d} kind="dungeon" />
        ))}
      </div>
    </div>
  )
}
