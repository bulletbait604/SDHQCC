'use client'

import { Copy } from 'lucide-react'
import type { BuildIntelligenceCard } from '@/lib/destiny/types'
import {
  ActivityBadge,
  GearStrip,
  SubclassBadge,
  StatusPill,
} from '@/app/components/destiny/DestinyUi'
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

  return (
    <div className={cn('rounded-2xl p-4', t.glassInset)}>
      <div className="flex justify-between gap-2 mb-2">
        <p className={cn('font-semibold text-sm tracking-tight', t.heading)}>{build.buildName}</p>
        {!compact && <StatusPill label={build.role} tone="gold" />}
      </div>
      {!compact && (
        <ActivityBadge activityRef={build.activityRef} name={build.activityName} darkMode={darkMode} size={36} />
      )}
      <div className="mt-3">
        <SubclassBadge
          classRef={build.classRef}
          subclassRef={build.subclassRef}
          characterClass={build.characterClass}
          subclass={build.subclass}
          darkMode={darkMode}
        />
      </div>
      <div className="mt-3">
        <GearStrip
          darkMode={darkMode}
          size={compact ? 32 : 36}
          items={[build.exoticArmorRef, build.exoticWeaponRef, ...(build.weaponRefs ?? [])]}
        />
      </div>
      {!compact && (
        <>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <span className={t.gold}>{build.usageRatePercent}% usage</span>
            <span className={t.blue}>{build.successRatePercent}% success</span>
            <span className={t.muted}>Avg {formatDuration(build.averageClearSeconds)}</span>
            <span className={t.muted}>{build.deathRatePercent}% deaths</span>
          </div>
          <button
            type="button"
            className="mt-3 flex items-center gap-1 text-xs text-white/60 hover:text-white/90"
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
