'use client'

import type { BuildSnapshot, DestinyIconRef, PlayerProfile } from '@/lib/destiny/types'
import {
  AbilityChip,
  BuildSection,
  GameCard,
  GlowIcon,
  IconTooltip,
} from '@/app/components/destiny/destinyGameUi'
import ArmorStatMatrix from '@/app/components/destiny/ArmorStatMatrix'
import BuildSynergyRail from '@/app/components/destiny/BuildSynergyRail'
import { CharacterTileRow } from '@/app/components/destiny/CharacterTile'
import GuardianProfileBanner from '@/app/components/destiny/GuardianProfileBanner'
import WeaponArmoryTable, { buildWeaponRows } from '@/app/components/destiny/WeaponArmoryTable'
import { getDestinyTheme, subclassGlow } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

interface Props {
  profile: PlayerProfile
  darkMode: boolean
}

const ABILITY_SLOTS = [
  { slot: 'Super', getRef: (l?: BuildSnapshot) => l?.superRef, getFallback: (l?: BuildSnapshot) => l?.super },
  { slot: 'Class', getRef: (l?: BuildSnapshot) => l?.classAbilityRef, getFallback: (l?: BuildSnapshot) => l?.abilities?.[1] },
  { slot: 'Jump', getRef: (l?: BuildSnapshot) => l?.jumpRef, getFallback: (l?: BuildSnapshot) => l?.abilities?.[2] },
  { slot: 'Melee', getRef: (l?: BuildSnapshot) => l?.meleeRef, getFallback: (l?: BuildSnapshot) => l?.abilities?.[3] },
  { slot: 'Grenade', getRef: (l?: BuildSnapshot) => l?.grenadeRef, getFallback: (l?: BuildSnapshot) => l?.abilities?.[4] },
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

/** Full build inspector — Tracker banner, light.gg armory, stat matrix, synergy rail. */
export default function PlayerCardDetail({ profile, darkMode }: Props) {
  const t = getDestinyTheme(darkMode)
  const loadout = profile.currentLoadout
  const elementGlow = subclassGlow(loadout?.subclass)
  const characters =
    profile.characters?.length
      ? profile.characters
      : profile.characterClass
        ? [
            {
              characterId: profile.activeCharacterId ?? 'active',
              characterClass: profile.characterClass,
              powerLevel: profile.powerLevel ?? 0,
              emblemUrl: profile.displayEmblem?.iconUrl ?? profile.emblemUrl,
              emblemBackgroundUrl: profile.displayEmblem?.backgroundUrl ?? profile.emblemBackgroundUrl,
              emblemColor: profile.displayEmblem?.color ?? profile.emblemColor,
              classRef: profile.classRef,
            },
          ]
        : []

  const trust = profile.trustRank

  return (
    <GameCard className="w-full overflow-hidden p-0">
      <GuardianProfileBanner profile={profile}>
        {characters.length ? (
          <div className="mt-3">
            <CharacterTileRow
              characters={characters}
              activeCharacterId={profile.activeCharacterId}
              subtitleFor={(c) =>
                c.characterId === profile.activeCharacterId && loadout?.subclass
                  ? loadout.subclass
                  : undefined
              }
            />
          </div>
        ) : null}
      </GuardianProfileBanner>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-black/20">
        {profile.trustRank ? (
          <div className="d2-trust-badge-compact" title={trust?.topNestTitle}>
            <span className="text-xs font-black text-amber-300">T.R.</span>
            <span className="text-[9px] text-white/60 ml-1">{trust?.topNestTitle}</span>
          </div>
        ) : null}
        <p className={cn('text-xs ml-auto', t.caption)}>
          {loadout?.subclass ?? 'Subclass'} · PL {profile.powerLevel ?? '—'}
        </p>
      </div>

      {!loadout ? (
        <p className={cn('p-4 text-sm', t.muted)}>Sync Bungie to load live build data.</p>
      ) : (
        <div className="p-3 space-y-3">
          <BuildSynergyRail build={loadout} />

          <BuildSection label="Armory">
            <WeaponArmoryTable rows={buildWeaponRows(loadout)} title="Equipped" />
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

          <BuildSection label="Armor stats">
            <ArmorStatMatrix stats={loadout.stats} compact />
          </BuildSection>
        </div>
      )}
    </GameCard>
  )
}
