'use client'

import { Copy, ExternalLink } from 'lucide-react'
import type { ExternalBuildSource } from '@/lib/destiny/types'
import {
  GearStrip,
  ItemIcon,
  SubclassBadge,
  StatusPill,
} from '@/app/components/destiny/DestinyUi'
import { getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

export default function ExternalMetaBuildCard({
  build,
  darkMode,
}: {
  build: ExternalBuildSource
  darkMode: boolean
}) {
  const t = getDestinyTheme(darkMode)

  const copyText = [
    build.title,
    `${build.subclass} ${build.class}`,
    build.exoticArmor ? `Exotic: ${build.exoticArmor}` : '',
    build.exoticWeapon ? `Heavy exotic: ${build.exoticWeapon}` : '',
    build.weapons?.length ? `Weapons: ${build.weapons.join(' / ')}` : '',
    build.summary ?? '',
    build.sourceUrl,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div className={cn('rounded-2xl p-4', t.glassInset)}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className={cn('font-semibold text-sm tracking-tight', t.heading)}>{build.title}</p>
          <p className={cn('text-xs mt-0.5', t.muted)}>
            {build.source}
            {build.publishedAt && (
              <> · {new Date(build.publishedAt).toLocaleDateString()}</>
            )}
          </p>
        </div>
        {build.excelsIn && <StatusPill label={build.excelsIn} tone="purple" />}
      </div>

      <SubclassBadge
        classRef={build.classRef}
        subclassRef={build.subclassRef}
        characterClass={build.class}
        subclass={build.subclass}
        darkMode={darkMode}
      />

      {build.exoticArmorRef && (
        <div className="mt-3 flex items-center gap-2">
          <ItemIcon item={build.exoticArmorRef} name={build.exoticArmor} size={36} />
          <span className={cn('text-sm', t.body)}>{build.exoticArmorRef.name ?? build.exoticArmor}</span>
        </div>
      )}

      {(build.weaponRefs?.length || build.exoticWeaponRef) && (
        <div className="mt-3">
          <p className={cn('text-xs mb-2', t.caption)}>Weapons</p>
          <GearStrip
            darkMode={darkMode}
            size={32}
            items={[
              ...(build.weaponRefs ?? []),
              ...(build.exoticWeaponRef ? [build.exoticWeaponRef] : []),
            ]}
          />
        </div>
      )}

      {build.summary && (
        <p className={cn('text-xs mt-3 leading-relaxed', t.muted)}>{build.summary}</p>
      )}

      {build.activityFocus && (
        <p className={cn('text-xs mt-2', t.gold)}>{build.activityFocus}</p>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <a
          href={build.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-sky-500/15 text-sky-200 border border-sky-500/25"
        >
          View source <ExternalLink className="w-3 h-3" />
        </a>
        <button
          type="button"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/10"
          onClick={() => navigator.clipboard.writeText(copyText)}
        >
          <Copy className="w-3 h-3" /> Copy
        </button>
      </div>
    </div>
  )
}
