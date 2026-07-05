'use client'

import type { BuildSnapshot, DestinyIconRef, PlayerProfile } from '@/lib/destiny/types'
import {
  AbilityChip,
  BuildSection,
  CharacterEmblem,
  GameCard,
  GlowIcon,
  IconTooltip,
  StatOrb,
} from '@/app/components/destiny/destinyGameUi'
import { getDestinyTheme, subclassGlow } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

interface Props {
  profile: PlayerProfile
  darkMode: boolean
}

const STAT_KEYS = [
  { key: 'Resilience' as const, label: 'HP' },
  { key: 'Strength' as const, label: 'ME' },
  { key: 'Discipline' as const, label: 'GN' },
  { key: 'Intellect' as const, label: 'SU' },
  { key: 'Mobility' as const, label: 'CL' },
  { key: 'Recovery' as const, label: 'WE' },
] as const

const ABILITY_SLOTS = [
  { slot: 'Super', getRef: (l?: BuildSnapshot) => l?.superRef, getFallback: (l?: BuildSnapshot) => l?.super },
  { slot: 'Class', getRef: (l?: BuildSnapshot) => l?.classAbilityRef, getFallback: (l?: BuildSnapshot) => l?.abilities?.[1] },
  { slot: 'Jump', getRef: (l?: BuildSnapshot) => l?.jumpRef, getFallback: (l?: BuildSnapshot) => l?.abilities?.[2] },
  { slot: 'Melee', getRef: (l?: BuildSnapshot) => l?.meleeRef, getFallback: (l?: BuildSnapshot) => l?.abilities?.[3] },
  { slot: 'Grenade', getRef: (l?: BuildSnapshot) => l?.grenadeRef, getFallback: (l?: BuildSnapshot) => l?.abilities?.[4] },
] as const

const WEAPON_SLOTS = [
  { slot: 'Kinetic', getRef: (l?: BuildSnapshot) => l?.kineticWeaponRef, getFallback: (l?: BuildSnapshot) => l?.kineticWeapon },
  { slot: 'Energy', getRef: (l?: BuildSnapshot) => l?.energyWeaponRef, getFallback: (l?: BuildSnapshot) => l?.energyWeapon },
  { slot: 'Power', getRef: (l?: BuildSnapshot) => l?.powerWeaponRef, getFallback: (l?: BuildSnapshot) => l?.powerWeapon },
] as const

function AbilitySlotCell({
  slot,
  item,
  fallback,
  glow,
  size = 48,
}: {
  slot: string
  item?: DestinyIconRef
  fallback?: string
  glow: 'gold' | 'arc' | 'void' | 'solar' | 'strand' | 'stasis' | 'neutral' | 'auto'
  size?: number
}) {
  return (
    <div className="flex flex-col items-center min-w-0">
      <AbilityChip item={item} fallback={fallback} size={size} glow={glow} slotLabel={slot} />
      <span className="d2-slot-label truncate w-full">{slot}</span>
    </div>
  )
}

/** Full build card for Profile — abilities, weapons, stats, loadout. */
export default function PlayerCardDetail({ profile, darkMode }: Props) {
  const t = getDestinyTheme(darkMode)
  const loadout = profile.currentLoadout
  const elementGlow = subclassGlow(loadout?.subclass)
  const emblem = profile.displayEmblem
  const emblemBg = emblem?.backgroundUrl ?? profile.emblemBackgroundUrl
  const emblemIcon = emblem?.iconUrl ?? profile.emblemUrl

  return (
    <GameCard className="w-full">
      <div className="flex gap-3 p-3 border-b border-white/[0.06]">
        <CharacterEmblem
          backgroundUrl={emblemBg}
          iconUrl={emblemIcon}
          accentColor={emblem?.color ?? profile.emblemColor}
          characterClass={profile.characterClass}
          classIconUrl={profile.classRef?.iconUrl}
          title={emblem?.name ?? 'Emblem'}
        />
        <div className="flex-1 min-w-0">
          <h3 className={cn('text-lg font-black', t.heading)}>{profile.bungieDisplayName}</h3>
          <p className={cn('text-xs uppercase tracking-wide', t.caption)}>
            {loadout?.subclass ?? 'Subclass'} · {profile.characterClass ?? '—'} · PL {profile.powerLevel ?? '—'}
          </p>
        </div>
      </div>

      {!loadout ? (
        <p className={cn('p-4 text-sm', t.muted)}>Sync Bungie to load live build data.</p>
      ) : (
        <div className="p-3 space-y-2.5">
          <BuildSection label="Subclass">
            <div className="flex items-center gap-3">
              <AbilityChip item={loadout.subclassRef} fallback={loadout.subclass} size={52} glow={elementGlow} slotLabel="Subclass" />
              <p className="text-sm font-bold text-white/90 truncate flex-1">{loadout.subclass}</p>
            </div>
          </BuildSection>

          <BuildSection label="Abilities">
            <div className="d2-ability-grid">
              {ABILITY_SLOTS.map(({ slot, getRef, getFallback }) => (
                <AbilitySlotCell
                  key={slot}
                  slot={slot}
                  item={getRef(loadout)}
                  fallback={getFallback(loadout)}
                  glow={elementGlow}
                />
              ))}
            </div>
          </BuildSection>

          {(loadout.aspectRefs?.length || loadout.fragmentRefs?.length) ? (
            <BuildSection label="Aspects & Fragments">
              <div className="flex flex-wrap gap-2">
                {loadout.aspectRefs?.map((a) => (
                  <AbilityChip key={a.name} item={a} size={44} glow={elementGlow} slotLabel="Aspect" />
                ))}
                {loadout.fragmentRefs?.map((f) => (
                  <IconTooltip key={f.name} slotLabel="Fragment" name={f.name} tier={f.tierLabel}>
                    <GlowIcon item={f} size={36} glow={elementGlow} className="rounded-lg" />
                  </IconTooltip>
                ))}
              </div>
            </BuildSection>
          ) : null}

          {WEAPON_SLOTS.some(({ getRef, getFallback }) => getRef(loadout) || getFallback(loadout)) ? (
            <BuildSection label="Weapons">
              <div className="grid grid-cols-3 gap-2">
                {WEAPON_SLOTS.map(({ slot, getRef, getFallback }) => (
                  <AbilitySlotCell
                    key={slot}
                    slot={slot}
                    item={getRef(loadout)}
                    fallback={getFallback(loadout)}
                    glow="auto"
                    size={44}
                  />
                ))}
              </div>
            </BuildSection>
          ) : null}

          <BuildSection label="Armor stats">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {STAT_KEYS.map(({ key, label }) => (
                <StatOrb key={key} statKey={key} label={label} value={loadout.stats[key] ?? '—'} darkMode={darkMode} />
              ))}
            </div>
          </BuildSection>
        </div>
      )}
    </GameCard>
  )
}
