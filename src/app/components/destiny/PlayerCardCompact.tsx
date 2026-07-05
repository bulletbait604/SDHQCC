'use client'

import type { PlayerProfile } from '@/lib/destiny/types'
import { CharacterEmblem, GameCard, GlowIcon } from '@/app/components/destiny/destinyGameUi'
import { getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

interface Props {
  profile: PlayerProfile | null
  darkMode: boolean
  linked?: boolean
  loading?: boolean
}

function classLabel(characterClass?: string) {
  if (!characterClass) return 'Guardian'
  return characterClass.charAt(0).toUpperCase() + characterClass.slice(1)
}

/** Short wide banner — emblem, class, name, GR, PL, T.R. only. */
export default function PlayerCardCompact({ profile, darkMode, linked = true, loading }: Props) {
  const t = getDestinyTheme(darkMode)

  if (loading) {
    return (
      <div className={cn('d2-game-card d2-player-compact animate-pulse w-full max-w-3xl', t.glassInset)}>
        <div className="h-[72px] rounded-xl bg-white/5 mx-3 my-2" />
      </div>
    )
  }

  if (!profile) {
    return (
      <GameCard className="d2-player-compact w-full max-w-3xl px-4 py-3">
        <p className={cn('text-xs text-center', t.muted)}>Link Bungie to load your Guardian</p>
      </GameCard>
    )
  }

  const trust = profile.trustRank
  const emblem = profile.displayEmblem
  const emblemBg = emblem?.backgroundUrl ?? profile.emblemBackgroundUrl
  const emblemIcon = emblem?.iconUrl ?? profile.emblemUrl

  return (
    <GameCard className="d2-player-compact w-full max-w-3xl">
      <div className="flex items-center gap-3 px-3 py-2 min-h-[76px]">
        <CharacterEmblem
          compact
          backgroundUrl={emblemBg}
          iconUrl={emblemIcon}
          accentColor={emblem?.color ?? profile.emblemColor}
          characterClass={profile.characterClass}
          classIconUrl={profile.classRef?.iconUrl}
          title={emblem?.name ?? 'Emblem'}
        />

        <div className="flex-1 min-w-0 flex items-center gap-3">
          {profile.classRef ? (
            <GlowIcon item={profile.classRef} size={32} glow="auto" className="rounded-full shrink-0" />
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-black text-white truncate leading-tight">
              {profile.bungieDisplayName}
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
              {classLabel(profile.characterClass)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="d2-compact-stat" title="Guardian Rank">
            <span className="d2-compact-stat-label">GR</span>
            <span className="d2-compact-stat-value">{profile.guardianRank ?? '—'}</span>
          </div>
          <div className="d2-compact-stat d2-compact-stat-gold" title="Gear Level">
            <span className="d2-compact-stat-label">PL</span>
            <span className="d2-compact-stat-value">{profile.powerLevel ?? '—'}</span>
          </div>
          <div className="d2-trust-badge-compact shrink-0" title={trust?.topNestTitle ?? 'Unrated'}>
            <span className="text-sm font-black text-amber-300 leading-none">T.R.</span>
          </div>
        </div>
      </div>

      {!linked && (
        <p className="text-[10px] text-center text-amber-200/60 pb-2">Connect Bungie on Home</p>
      )}
    </GameCard>
  )
}
