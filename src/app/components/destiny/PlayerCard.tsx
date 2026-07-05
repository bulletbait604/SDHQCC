'use client'

import type { BuildSnapshot, PlayerProfile } from '@/lib/destiny/types'
import {
  AbilityChip,
  GameCard,
  GlowIcon,
  PowerBadge,
  StatOrb,
  TrustBadge,
} from '@/app/components/destiny/destinyGameUi'
import { getDestinyTheme, subclassGlow } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

interface Props {
  profile: PlayerProfile | null
  darkMode: boolean
  linked?: boolean
  loading?: boolean
}

const STAT_KEYS = [
  { key: 'Resilience' as const, label: 'HP' },
  { key: 'Strength' as const, label: 'ME' },
  { key: 'Discipline' as const, label: 'GN' },
  { key: 'Intellect' as const, label: 'SU' },
  { key: 'Mobility' as const, label: 'CL' },
  { key: 'Recovery' as const, label: 'WE' },
]

function abilitySlots(loadout?: BuildSnapshot) {
  return [
    loadout?.superRef,
    loadout?.classAbilityRef,
    loadout?.jumpRef,
    loadout?.meleeRef,
    loadout?.grenadeRef,
  ]
}

export default function PlayerCard({ profile, darkMode, linked = true, loading }: Props) {
  const t = getDestinyTheme(darkMode)
  const elementGlow = subclassGlow(profile?.currentLoadout?.subclass)

  if (loading) {
    return (
      <div className={cn('d2-game-card max-w-lg p-6 animate-pulse', t.glassInset)}>
        <div className="h-24 rounded-xl bg-white/5" />
      </div>
    )
  }

  if (!profile) {
    return (
      <GameCard className="max-w-lg p-5">
        <GlowIcon size={48} glow="gold" className="mx-auto mb-3 opacity-50" />
        <p className={cn('text-center text-xs', t.muted)}>Link Bungie to load your Guardian</p>
      </GameCard>
    )
  }

  const loadout = profile.currentLoadout
  const abilities = abilitySlots(loadout)
  const trust = profile.trustRank
  const emblemBg = profile.emblemBackgroundUrl ?? profile.emblemUrl
  const accent = profile.emblemColor ?? 'rgba(60, 40, 100, 0.65)'
  const weapons = [loadout?.kineticWeaponRef, loadout?.energyWeaponRef, loadout?.powerWeaponRef]

  return (
    <GameCard
      className="w-full max-w-lg"
      bannerUrl={emblemBg}
      accentColor={accent}
      bannerOverlay={`linear-gradient(105deg, ${accent} 0%, rgba(8,10,18,0.92) 45%, rgba(8,10,18,0.98) 100%)`}
    >
      {/* Hero row — emblem + identity */}
      <div className="flex gap-3 p-3 pb-2">
        <div className="relative shrink-0">
          {profile.emblemUrl ? (
            <GlowIcon item={{ name: 'Emblem', iconUrl: profile.emblemUrl }} size={64} glow="gold" className="rounded-2xl" />
          ) : (
            <GlowIcon size={64} glow="neutral" className="rounded-2xl" />
          )}
          {profile.characterThumbnailUrl ? (
            <img
              src={profile.characterThumbnailUrl}
              alt=""
              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-lg ring-2 ring-[#0a0c12] object-cover shadow-lg"
            />
          ) : null}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-2">
            <GlowIcon item={profile.classRef} size={28} glow="auto" className="rounded-full" />
            <h2 className="text-lg font-black text-white truncate drop-shadow-md">{profile.bungieDisplayName}</h2>
          </div>
          <PowerBadge power={profile.powerLevel} rank={profile.guardianRank} />
        </div>

        <TrustBadge title={trust?.topNestTitle ?? 'Unrated'} darkMode={darkMode} />
      </div>

      {/* Subclass + abilities — icon strip */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <AbilityChip item={loadout?.subclassRef} fallback={loadout?.subclass} size={48} glow={elementGlow} />
          <div className="flex-1 flex flex-wrap gap-1.5 justify-end">
            {abilities.map((ref, i) => (
              <AbilityChip key={i} item={ref} size={52} glow={elementGlow} />
            ))}
          </div>
        </div>

        {/* Aspects + fragments — icons only */}
        {(loadout?.aspectRefs?.length || loadout?.fragmentRefs?.length) ? (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {loadout?.aspectRefs?.map((a) => (
              <AbilityChip key={a.name} item={a} size={40} glow={elementGlow} />
            ))}
            {loadout?.fragmentRefs?.map((f) => (
              <GlowIcon key={f.name} item={f} size={32} glow={elementGlow} className="rounded-lg" title={f.name} />
            ))}
          </div>
        ) : null}

        {/* Weapons loadout */}
        {weapons.some(Boolean) ? (
          <div className="flex gap-2 mb-2">
            {weapons.map((w, i) => (
              <AbilityChip key={i} item={w} size={44} glow="auto" />
            ))}
          </div>
        ) : null}

        {/* Armor stats — big orbs */}
        <div className="flex flex-wrap gap-1.5">
          {STAT_KEYS.map(({ key, label }) => (
            <StatOrb
              key={key}
              statKey={key}
              label={label}
              value={loadout?.stats[key] ?? '—'}
              darkMode={darkMode}
            />
          ))}
        </div>
      </div>

      {/* Custom stat card picks — icon chips */}
      {profile.flexStats?.length ? (
        <div className="flex gap-2 px-3 pb-3 border-t border-white/5 pt-2">
          {profile.flexStats.slice(0, 2).map((stat) => (
            <div
              key={stat.id}
              className="flex-1 rounded-xl bg-black/35 ring-1 ring-amber-400/20 px-3 py-2 text-center shadow-inner"
              title={stat.detail}
            >
              <p className="text-xl font-black text-amber-300 tabular-nums leading-none">{stat.value}</p>
              <p className="text-[9px] uppercase tracking-wider text-white/40 mt-1 truncate">{stat.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {!linked && (
        <p className="text-[10px] text-center text-amber-200/60 pb-2 px-3">Connect Bungie on Home</p>
      )}
    </GameCard>
  )
}
