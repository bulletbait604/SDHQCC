'use client'

import type { BuildSnapshot } from '@/lib/destiny/types'
import { D2_ELEMENTS, elementFromLabel, subclassGlow } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

const GLOW_CLASS = {
  arc: 'd2-synergy-arc',
  void: 'd2-synergy-void',
  solar: 'd2-synergy-solar',
  strand: 'd2-synergy-strand',
  stasis: 'd2-synergy-stasis',
  gold: 'd2-synergy-gold',
} as const

function weaponElements(build: BuildSnapshot): (string | null)[] {
  return [
    elementFromLabel(build.kineticWeaponRef?.name ?? build.kineticWeapon),
    elementFromLabel(build.energyWeaponRef?.name ?? build.energyWeapon),
    elementFromLabel(build.powerWeaponRef?.name ?? build.powerWeapon),
  ]
}

/** Step-beyond: subclass ↔ loadout element synergy indicator. */
export default function BuildSynergyRail({ build }: { build: BuildSnapshot }) {
  const glow = subclassGlow(build.subclass)
  const weapons = weaponElements(build)
  const subElement = elementFromLabel(build.subclass)
  const matches = weapons.filter((w) => w && subElement && w === subElement).length
  const score = subElement ? matches : 0
  const label =
    score >= 2
      ? 'High synergy'
      : score === 1
        ? 'Partial synergy'
        : subElement
          ? 'Mixed elements'
          : 'Build overview'

  return (
    <div className={cn('d2-synergy-rail', GLOW_CLASS[glow])}>
      <div className="d2-synergy-subclass">
        {build.subclassRef?.iconUrl ? (
          <img src={build.subclassRef.iconUrl} alt="" className="w-8 h-8 rounded-sm object-cover" />
        ) : null}
        <div>
          <p className="d2-synergy-label">{label}</p>
          <p className="d2-synergy-sub">{build.subclass} · {build.characterClass}</p>
        </div>
      </div>
      <div className="d2-synergy-weapons">
        {['K', 'E', 'P'].map((slot, i) => {
          const el = weapons[i]
          return (
            <div
              key={slot}
              className={cn(
                'd2-synergy-pip',
                el && `d2-element-${el}`,
                el && subElement && el === subElement && 'd2-synergy-pip-match'
              )}
              style={el ? ({ '--d2-el': D2_ELEMENTS[el as keyof typeof D2_ELEMENTS] } as React.CSSProperties) : undefined}
              title={el ?? 'kinetic'}
            >
              {slot}
            </div>
          )
        })}
      </div>
      {build.exoticArmor ? (
        <p className="d2-synergy-exotic truncate" title={build.exoticArmor}>
          {build.exoticArmor}
        </p>
      ) : null}
    </div>
  )
}
