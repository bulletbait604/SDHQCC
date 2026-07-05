'use client'

import type { BuildSnapshot, PlayerProfile } from '@/lib/destiny/types'
import { ItemIcon } from '@/app/components/destiny/DestinyUi'
import { getDestinyTheme, platformIcon } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

interface Props {
  profile: PlayerProfile | null
  darkMode: boolean
  linked?: boolean
  loading?: boolean
  compact?: boolean
}

function abilityRow(loadout?: BuildSnapshot) {
  if (!loadout) return { super: '—', classAbility: '—', jump: '—', melee: '—', grenade: '—' }
  const [superA, classA, jump, melee, grenade] = loadout.abilities
  return {
    super: loadout.super || superA || '—',
    classAbility: classA || '—',
    jump: jump || '—',
    melee: melee || '—',
    grenade: grenade || '—',
  }
}

const STAT_DISPLAY = [
  { key: 'Resilience', label: 'Health' },
  { key: 'Strength', label: 'Melee' },
  { key: 'Discipline', label: 'Grenade' },
  { key: 'Intellect', label: 'Super' },
  { key: 'Mobility', label: 'Class' },
  { key: 'Recovery', label: 'Weapons' },
] as const

export default function PlayerCard({ profile, darkMode, linked = true, loading, compact }: Props) {
  const t = getDestinyTheme(darkMode)

  if (loading) {
    return (
      <div className={cn('rounded-2xl ring-1 ring-white/10 p-6', t.glassInset)}>
        <p className={cn('text-sm animate-pulse', t.muted)}>Loading player card…</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className={cn('rounded-2xl ring-1 ring-white/10 p-6', t.glassInset)}>
        <p className={cn('text-sm', t.muted)}>Sign in and link Bungie to load your player card.</p>
      </div>
    )
  }

  const loadout = profile.currentLoadout
  const abilities = abilityRow(loadout)
  const customStats = profile.flexStats?.slice(0, 2) ?? []
  const trust = profile.trustRank
  const classLabel =
    profile.characterClass ? profile.characterClass.charAt(0).toUpperCase() + profile.characterClass.slice(1) : '—'

  return (
    <div
      className={cn(
        'rounded-2xl ring-1 ring-white/10 overflow-hidden',
        darkMode ? 'bg-[#0f1117]' : 'bg-slate-900'
      )}
    >
      <div className={cn('flex flex-col xl:flex-row', compact ? 'min-h-0' : 'min-h-[200px]')}>
        {/* Left — emblem + custom stats */}
        <div className="xl:w-44 shrink-0 p-4 border-b xl:border-b-0 xl:border-r border-white/10 flex xl:flex-col items-center gap-3">
          {profile.emblemUrl ? (
            <img
              src={profile.emblemUrl}
              alt=""
              className="w-20 h-20 xl:w-28 xl:h-28 rounded-xl ring-1 ring-white/15 object-cover"
            />
          ) : (
            <div className="w-20 h-20 xl:w-28 xl:h-28 rounded-xl bg-white/10 ring-1 ring-white/10" />
          )}
          <div className="flex-1 xl:w-full space-y-2">
            {customStats.length ? (
              customStats.map((stat) => (
                <div key={stat.id} className="rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-2 py-1.5">
                  <p className="text-[9px] uppercase tracking-wide text-white/40">{stat.label}</p>
                  <p className="text-sm font-semibold text-amber-200/90 tabular-nums">{stat.value}</p>
                  {stat.detail ? (
                    <p className="text-[9px] text-white/35 truncate">{stat.detail}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <>
                <div className="rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-2 py-1.5">
                  <p className="text-[9px] text-white/40">Custom stat</p>
                  <p className="text-sm text-white/30">—</p>
                </div>
                <div className="rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-2 py-1.5">
                  <p className="text-[9px] text-white/40">Custom stat</p>
                  <p className="text-sm text-white/30">—</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center — identity + build */}
        <div className="flex-1 p-4 min-w-0 border-b xl:border-b-0 xl:border-r border-white/10">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {profile.classRef && <ItemIcon item={profile.classRef} size={24} className="rounded-full" />}
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
              {profile.bungieDisplayName}
            </h2>
          </div>
          <p className="text-xs text-white/50 mb-0.5">
            GR {profile.guardianRank ?? '—'} / PL {profile.powerLevel ?? '—'}
          </p>
          <p className="text-xs text-white/45 mb-3">
            {classLabel} · {platformIcon(profile.platform)}
            {!linked && ' · Link Bungie on Home'}
          </p>

          <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1.5">Current build abilities</p>
          <p className="text-xs text-white/80 mb-2">
            <span className="text-amber-200/80">{loadout?.subclass ?? 'Subclass'}</span>
          </p>
          <p className="text-[11px] text-white/70 leading-relaxed break-words">
            {abilities.super} | {abilities.classAbility} | {abilities.jump} | {abilities.melee} |{' '}
            {abilities.grenade}
          </p>

          {(loadout?.aspects.length || loadout?.fragments.length) ? (
            <div className="mt-3 space-y-1">
              {loadout?.aspects.length ? (
                <p className="text-[11px] text-white/60">
                  <span className="text-white/40">Aspects</span> {loadout.aspects.join(' | ')}
                </p>
              ) : null}
              {loadout?.fragments.length ? (
                <p className="text-[11px] text-white/60">
                  <span className="text-white/40">Fragments</span>{' '}
                  {loadout.fragments.map((f, i) => (
                    <span key={f}>
                      {i + 1} {f}{' '}
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Right — Trust Rank + stats */}
        <div className="xl:w-52 shrink-0 p-4 flex flex-col">
          <div className="text-right mb-3">
            <p className="text-3xl font-black text-amber-300/90 tracking-tighter">T.R.</p>
            <p className="text-xs font-semibold text-white mt-1">{trust?.topNestTitle ?? 'Unrated Guardian'}</p>
            {trust && trust.reviewCount > 0 ? (
              <p className="text-[10px] text-white/45 mt-0.5">
                {trust.knowledgeTier} · {trust.vibesTier} · {trust.reviewCount} commends
              </p>
            ) : (
              <p className="text-[10px] text-white/40 mt-0.5">No commends yet</p>
            )}
          </div>

          <div className="mt-auto">
            <p className="text-[10px] uppercase tracking-wide text-white/40 mb-2 text-center">Stats</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              {STAT_DISPLAY.map(({ key, label }) => (
                <div key={key} className="flex justify-between gap-1">
                  <span className="text-white/45">{label}</span>
                  <span className="text-amber-200/80 tabular-nums font-medium">
                    {loadout?.stats[key] ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
