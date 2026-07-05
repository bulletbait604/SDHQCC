'use client'

import { Copy } from 'lucide-react'
import type { BuildSnapshot } from '@/lib/destiny/types'
import ArmorStatMatrix from '@/app/components/destiny/ArmorStatMatrix'
import BuildSynergyRail from '@/app/components/destiny/BuildSynergyRail'
import { SubclassBadge } from '@/app/components/destiny/DestinyUi'
import WeaponArmoryTable, { buildWeaponRows } from '@/app/components/destiny/WeaponArmoryTable'
import { destinySecondaryBtn, getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

export function loadoutCopyText(build: BuildSnapshot): string {
  return [
    `${build.subclass} ${build.characterClass}`,
    `Exotic: ${build.exoticArmor}${build.exoticWeapon ? ` / ${build.exoticWeapon}` : ''}`,
    `Weapons: ${build.kineticWeapon} / ${build.energyWeapon} / ${build.powerWeapon}`,
    build.aspects.length ? `Aspects: ${build.aspects.join(', ')}` : '',
    build.fragments.length ? `Fragments: ${build.fragments.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export default function LoadoutCard({
  build,
  darkMode,
  title,
  showEquip = true,
}: {
  build: BuildSnapshot
  darkMode: boolean
  title: string
  showEquip?: boolean
}) {
  const t = getDestinyTheme(darkMode)

  return (
    <div className="d2-panel-inset p-4 rounded-lg space-y-3">
      <p className="d2-panel-header-title text-[10px]">{title}</p>
      <BuildSynergyRail build={build} />
      <SubclassBadge
        classRef={build.classRef}
        subclassRef={build.subclassRef}
        characterClass={build.characterClass}
        subclass={build.subclass}
        darkMode={darkMode}
      />
      <WeaponArmoryTable rows={buildWeaponRows(build)} title="Loadout" />
      {Object.keys(build.stats).length > 0 ? (
        <div>
          <p className={cn('text-[9px] font-bold uppercase tracking-wider mb-2', t.caption)}>Stats</p>
          <ArmorStatMatrix stats={build.stats} compact />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          className={destinySecondaryBtn(darkMode)}
          onClick={() => navigator.clipboard.writeText(loadoutCopyText(build))}
        >
          <Copy className="w-3.5 h-3.5" /> Copy
        </button>
        {showEquip && (
          <button
            type="button"
            disabled
            className={cn(destinySecondaryBtn(darkMode), 'opacity-40 cursor-not-allowed')}
            title="Equip via Bungie — coming soon"
          >
            Equip
          </button>
        )}
      </div>
    </div>
  )
}
