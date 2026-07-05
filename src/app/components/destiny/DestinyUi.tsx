'use client'

import { cn } from '@/lib/utils'
import type { DestinyIconRef, LeaderboardEntry } from '@/lib/destiny/types'
import { formatDuration, getDestinyTheme, platformIcon } from '@/app/components/destiny/destinyTheme'

export function ItemIcon({
  item,
  name,
  iconUrl,
  size = 40,
  className,
  title,
}: {
  item?: DestinyIconRef
  name?: string
  iconUrl?: string
  size?: number
  className?: string
  title?: string
}) {
  const url = item?.iconUrl ?? iconUrl
  const label = item?.name ?? name ?? 'Item'
  const tier = item?.tierLabel

  if (url) {
    return (
      <img
        src={url}
        alt=""
        title={title ?? (tier ? `${label} (${tier})` : label)}
        className={cn('shrink-0 rounded-md border border-amber-500/30 bg-black/40 object-cover', className)}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      title={label}
      className={cn(
        'shrink-0 rounded-md border border-white/10 bg-purple-900/40 flex items-center justify-center text-[10px] text-purple-200 text-center px-0.5',
        className
      )}
      style={{ width: size, height: size }}
    >
      ?
    </div>
  )
}

export function GearStrip({
  items,
  darkMode,
  size = 36,
}: {
  items: (DestinyIconRef | undefined)[]
  darkMode: boolean
  size?: number
}) {
  const t = getDestinyTheme(darkMode)
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {items.filter(Boolean).map((item, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5 max-w-[72px]">
          <ItemIcon item={item} size={size} />
          <span className={cn('text-[10px] text-center line-clamp-2 leading-tight', t.muted)}>
            {item?.name}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SubclassBadge({
  classRef,
  subclassRef,
  characterClass,
  subclass,
  darkMode,
}: {
  classRef?: DestinyIconRef
  subclassRef?: DestinyIconRef
  characterClass: string
  subclass: string
  darkMode: boolean
}) {
  const t = getDestinyTheme(darkMode)
  return (
    <div className="flex items-center gap-2">
      <ItemIcon item={classRef} name={characterClass} size={32} className="rounded-full" />
      <ItemIcon item={subclassRef} name={subclass} size={28} />
      <span className={cn('text-sm text-white', t.muted)}>
        {subclass} {characterClass}
      </span>
    </div>
  )
}

export function ActivityBadge({
  activityRef,
  name,
  darkMode,
  size = 44,
}: {
  activityRef?: DestinyIconRef
  name: string
  darkMode: boolean
  size?: number
}) {
  return (
    <div className="flex items-center gap-3">
      <ItemIcon item={activityRef} name={name} size={size} className="rounded-lg" />
      <span className="text-white font-semibold text-sm">{name}</span>
    </div>
  )
}

export function GlassCard({
  children,
  className,
  darkMode,
}: {
  children: React.ReactNode
  className?: string
  darkMode: boolean
}) {
  const t = getDestinyTheme(darkMode)
  return (
    <div className={cn('rounded-xl p-4', t.glass, className)}>{children}</div>
  )
}

export function SectionTitle({
  title,
  subtitle,
  darkMode,
}: {
  title: string
  subtitle?: string
  darkMode: boolean
}) {
  const t = getDestinyTheme(darkMode)
  return (
    <div className="mb-3">
      <h4 className={cn('text-lg font-bold', t.heading)}>{title}</h4>
      {subtitle && <p className={cn('text-xs mt-0.5', t.muted)}>{subtitle}</p>}
    </div>
  )
}

export function LoadingBlock({ darkMode }: { darkMode: boolean }) {
  const t = getDestinyTheme(darkMode)
  return (
    <div className={cn('rounded-xl p-8 text-center animate-pulse', t.glass)}>
      <p className={t.muted}>Loading…</p>
    </div>
  )
}

export function EmptyBlock({
  darkMode,
  message,
}: {
  darkMode: boolean
  message: string
}) {
  const t = getDestinyTheme(darkMode)
  return (
    <div className={cn('rounded-xl p-8 text-center', t.glass)}>
      <p className={t.muted}>{message}</p>
    </div>
  )
}

export function LeaderboardTable({
  entries,
  darkMode,
  compact,
}: {
  entries: LeaderboardEntry[]
  darkMode: boolean
  compact?: boolean
}) {
  const t = getDestinyTheme(darkMode)

  if (!entries.length) {
    return <EmptyBlock darkMode={darkMode} message="No leaderboard entries yet." />
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-left text-sm min-w-[520px]">
        <thead>
          <tr className={cn('text-xs uppercase tracking-wide border-b border-white/10', t.muted)}>
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Guardian</th>
            {!compact && <th className="py-2 pr-2 hidden sm:table-cell">Clan</th>}
            <th className="py-2 pr-2">Plat</th>
            {!compact && <th className="py-2 pr-2 hidden md:table-cell">GR</th>}
            <th className="py-2 pr-2 hidden sm:table-cell">Power</th>
            <th className="py-2 pr-2">Pts</th>
            {!compact && <th className="py-2 pr-2 hidden lg:table-cell">Clears</th>}
            {!compact && <th className="py-2">Best</th>}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr
              key={`${e.userId}-${e.rank}`}
              className="border-b border-white/5 hover:bg-white/5 transition-colors"
            >
              <td className={cn('py-2.5 pr-2 font-bold', e.rank <= 3 ? t.gold : t.muted)}>
                {e.rank}
              </td>
              <td className="py-2.5 pr-2">
                <div className="flex items-center gap-2 min-w-0">
                  {e.emblemUrl ? (
                    <img
                      src={e.emblemUrl}
                      alt=""
                      className="w-8 h-8 rounded-full border border-amber-500/40 shrink-0 bg-black/40"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-purple-900/50 shrink-0" />
                  )}
                  <span className="text-white font-medium truncate">{e.bungieDisplayName}</span>
                </div>
              </td>
              {!compact && (
                <td className={cn('py-2.5 pr-2 hidden sm:table-cell text-xs', t.purple)}>
                  {e.clanTag ?? '—'}
                </td>
              )}
              <td className={cn('py-2.5 pr-2 text-xs', t.blue)}>{platformIcon(e.platform)}</td>
              {!compact && (
                <td className={cn('py-2.5 pr-2 hidden md:table-cell', t.muted)}>
                  {e.guardianRank ?? '—'}
                </td>
              )}
              <td className={cn('py-2.5 pr-2 hidden sm:table-cell', t.muted)}>
                {e.powerLevel ?? '—'}
              </td>
              <td className={cn('py-2.5 pr-2 font-semibold', t.gold)}>{e.points}</td>
              {!compact && (
                <td className={cn('py-2.5 pr-2 hidden lg:table-cell', t.muted)}>
                  {e.verifiedClears}
                </td>
              )}
              {!compact && (
                <td className="py-2.5 text-xs text-gray-300">
                  {e.fastestClearSeconds
                    ? `${formatDuration(e.fastestClearSeconds)} · ${e.fastestActivityName ?? ''}`
                    : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function StatusPill({
  label,
  tone,
}: {
  label: string
  tone: 'gold' | 'purple' | 'blue' | 'red' | 'green'
}) {
  const tones = {
    gold: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    blue: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    red: 'bg-red-500/20 text-red-300 border-red-500/40',
    green: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  }
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full border', tones[tone])}>{label}</span>
  )
}
