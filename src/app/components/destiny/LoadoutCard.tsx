'use client'

import { Copy } from 'lucide-react'
import type { BuildSnapshot } from '@/lib/destiny/types'
import { GearStrip, ItemIcon, SubclassBadge } from '@/app/components/destiny/DestinyUi'
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
    <div className={cn('rounded-2xl p-5', t.glassInset)}>
      <p className={cn('text-xs font-semibold mb-3 tracking-wide uppercase', t.caption)}>{title}</p>
      <SubclassBadge
        classRef={build.classRef}
        subclassRef={build.subclassRef}
        characterClass={build.characterClass}
        subclass={build.subclass}
        darkMode={darkMode}
      />
      <div className="mt-4">
        <p className={cn('text-xs mb-2', t.caption)}>Exotic armor</p>
        <div className="flex items-center gap-2">
          <ItemIcon item={build.exoticArmorRef} name={build.exoticArmor} size={44} />
          <span className={cn('text-sm font-medium', t.heading)}>
            {build.exoticArmorRef?.name ?? build.exoticArmor}
          </span>
        </div>
      </div>
      <div className="mt-4">
        <p className={cn('text-xs mb-2', t.caption)}>Weapons</p>
        <GearStrip
          darkMode={darkMode}
          items={[
            build.kineticWeaponRef,
            build.energyWeaponRef,
            build.powerWeaponRef,
            build.exoticWeaponRef,
          ]}
        />
      </div>
      {build.aspectRefs && build.aspectRefs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {build.aspectRefs.map((aspect, i) => (
            <ItemIcon key={i} item={aspect} size={28} title={aspect.name} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-4">
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
