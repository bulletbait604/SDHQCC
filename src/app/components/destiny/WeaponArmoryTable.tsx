'use client'

import type { DestinyIconRef } from '@/lib/destiny/types'
import { ItemIcon } from '@/app/components/destiny/DestinyUi'
import {
  D2_ELEMENTS,
  elementFromLabel,
  tierBorderClass,
} from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

export interface ArmoryRow {
  slot: string
  item?: DestinyIconRef
  fallback?: string
}

function tierShort(tier?: string) {
  const t = (tier ?? '').toLowerCase()
  if (t.includes('exotic')) return 'Exotic'
  if (t.includes('legendary')) return 'Legendary'
  if (t.includes('rare')) return 'Rare'
  if (t.includes('uncommon')) return 'Uncommon'
  return tier ?? '—'
}

function ElementStripe({ label }: { label?: string }) {
  const el = elementFromLabel(label)
  if (!el) return <span className="d2-armory-element d2-armory-element-neutral" title="Kinetic" />
  return (
    <span
      className={cn('d2-armory-element', `d2-element-${el}`)}
      style={{ '--d2-el': D2_ELEMENTS[el] } as React.CSSProperties}
      title={el}
    />
  )
}

function ArmoryRowView({ row }: { row: ArmoryRow }) {
  const name = row.item?.name ?? row.fallback
  if (!name) return null

  const tier = row.item?.tierLabel
  const rarityClass = tierBorderClass(tier).replace('d2-rarity-', '')

  return (
    <div className="d2-armory-row group">
      <span className="d2-armory-slot">{row.slot}</span>
      <ElementStripe label={name} />
      <ItemIcon item={row.item} name={row.fallback} size={40} className="d2-armory-icon" />
      <div className="d2-armory-name-wrap min-w-0">
        <p className="d2-armory-name truncate">{name}</p>
        {row.item?.entityType ? (
          <p className="d2-armory-type truncate">{row.item.entityType}</p>
        ) : null}
      </div>
      <span className={cn('d2-armory-tier', `d2-armory-tier-${rarityClass}`)}>{tierShort(tier)}</span>
    </div>
  )
}

/** light.gg–style weapon / gear table rows. */
export default function WeaponArmoryTable({
  rows,
  title = 'Armory',
  showHeader = true,
}: {
  rows: ArmoryRow[]
  title?: string
  showHeader?: boolean
}) {
  const visible = rows.filter((r) => r.item?.name || r.fallback)
  if (!visible.length) return null

  return (
    <div className="d2-armory-table">
      {showHeader ? (
        <div className="d2-armory-header">
          <span className="d2-armory-header-title">{title}</span>
          <span className="d2-armory-header-cols">
            <span>Slot</span>
            <span>Item</span>
            <span>Tier</span>
          </span>
        </div>
      ) : null}
      <div className="d2-armory-body">
        {visible.map((row) => (
          <ArmoryRowView key={`${row.slot}-${row.item?.name ?? row.fallback}`} row={row} />
        ))}
      </div>
    </div>
  )
}

export function buildWeaponRows(build: {
  kineticWeaponRef?: DestinyIconRef
  kineticWeapon?: string
  energyWeaponRef?: DestinyIconRef
  energyWeapon?: string
  powerWeaponRef?: DestinyIconRef
  powerWeapon?: string
  exoticWeaponRef?: DestinyIconRef
  exoticWeapon?: string
  exoticArmorRef?: DestinyIconRef
  exoticArmor?: string
}): ArmoryRow[] {
  return [
    { slot: 'Kin', item: build.kineticWeaponRef, fallback: build.kineticWeapon },
    { slot: 'Eng', item: build.energyWeaponRef, fallback: build.energyWeapon },
    { slot: 'Pow', item: build.powerWeaponRef, fallback: build.powerWeapon },
    { slot: 'Exo', item: build.exoticWeaponRef ?? build.exoticArmorRef, fallback: build.exoticWeapon ?? build.exoticArmor },
  ]
}
