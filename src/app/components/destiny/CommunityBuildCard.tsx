'use client'

import { Copy } from 'lucide-react'
import type { BuildIntelligenceCard } from '@/lib/destiny/types'
import {
  ActivityBadge,
  StatusPill,
  SubclassBadge,
} from '@/app/components/destiny/DestinyUi'
import WeaponArmoryTable from '@/app/components/destiny/WeaponArmoryTable'
import { formatDuration, getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

export default function CommunityBuildCard({
  build,
  darkMode,
  compact,
}: {
  build: BuildIntelligenceCard
  darkMode: boolean
  compact?: boolean
}) {
  const t = getDestinyTheme(darkMode)

  const weaponRows = [
    { slot: 'Exo', item: build.exoticArmorRef, fallback: build.exoticArmor },
    { slot: 'W1', item: build.weaponRefs?.[0], fallback: build.weapons[0] },
    { slot: 'W2', item: build.weaponRefs?.[1], fallback: build.weapons[1] },
    { slot: 'W3', item: build.weaponRefs?.[2], fallback: build.weapons[2] },
  ]

  return (
    <div className="d2-panel-inset p-4 rounded-lg space-y-3">
      <div className="flex justify-between gap-2">
        <p className="d2-panel-header-title text-xs">{build.buildName}</p>
        {!compact && <StatusPill label={build.role} tone="gold" />}
      </div>
      {!compact && (
        <ActivityBadge activityRef={build.activityRef} name={build.activityName} darkMode={darkMode} size={36} />
      )}
      <SubclassBadge
        classRef={build.classRef}
        subclassRef={build.subclassRef}
        characterClass={build.characterClass}
        subclass={build.subclass}
        darkMode={darkMode}
      />
      <WeaponArmoryTable rows={weaponRows} title="Gear" showHeader={!compact} />
      {!compact && (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span className={t.gold}>{build.usageRatePercent}% usage</span>
            <span className={t.blue}>{build.successRatePercent}% success</span>
            <span className={t.muted}>Avg {formatDuration(build.averageClearSeconds)}</span>
            <span className={t.muted}>{build.deathRatePercent}% deaths</span>
          </div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-white/60 hover:text-white/90"
            onClick={() =>
              navigator.clipboard.writeText(
                `${build.buildName}: ${build.subclass} ${build.characterClass}, ${build.exoticArmor}, ${build.weapons.join(', ')}`
              )
            }
          >
            <Copy className="w-3 h-3" /> Copy build
          </button>
        </>
      )}
    </div>
  )
}
