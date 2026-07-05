'use client'

import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DestinyIconRef, LeaderboardEntry } from '@/lib/destiny/types'
import {
  destinyChip,
  formatDuration,
  getDestinyTheme,
  platformIcon,
} from '@/app/components/destiny/destinyTheme'

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
        className={cn('shrink-0 rounded-xl bg-black/20 object-cover ring-1 ring-white/10', className)}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      title={label}
      className={cn(
        'shrink-0 rounded-xl bg-white/[0.06] ring-1 ring-white/10 flex items-center justify-center text-[10px] text-white/40',
        className
      )}
      style={{ width: size, height: size }}
    >
      ·
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
    <div className="flex flex-wrap gap-3 items-start">
      {items.filter(Boolean).map((item, i) => (
        <div key={i} className="flex flex-col items-center gap-1 max-w-[76px]">
          <ItemIcon item={item} size={size} />
          <span className={cn('text-[10px] text-center line-clamp-2 leading-snug', t.caption)}>
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
    <div className="flex items-center gap-3">
      <ItemIcon item={classRef} name={characterClass} size={36} className="rounded-full" />
      <ItemIcon item={subclassRef} name={subclass} size={32} />
      <span className={cn('text-sm font-medium', t.body)}>
        {subclass} · {characterClass}
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
  const t = getDestinyTheme(darkMode)
  return (
    <div className="flex items-center gap-3">
      <ItemIcon item={activityRef} name={name} size={size} className="rounded-2xl" />
      <span className={cn('font-semibold text-sm tracking-tight', t.heading)}>{name}</span>
    </div>
  )
}

export function GlassCard({
  children,
  className,
  darkMode,
  padding = 'default',
}: {
  children: React.ReactNode
  className?: string
  darkMode: boolean
  padding?: 'default' | 'lg' | 'none'
}) {
  const t = getDestinyTheme(darkMode)
  const pad = padding === 'lg' ? 'p-6 sm:p-7' : padding === 'none' ? '' : 'p-5 sm:p-6'
  return (
    <div className={cn('rounded-[1.25rem]', pad, t.glass, className)}>{children}</div>
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
    <div className="mb-4">
      <h4 className={cn('text-lg font-semibold tracking-tight', t.heading)}>{title}</h4>
      {subtitle && <p className={cn('text-sm mt-1 leading-relaxed', t.muted)}>{subtitle}</p>}
    </div>
  )
}

export function PageIntro({
  title,
  description,
  darkMode,
}: {
  title: string
  description?: string
  darkMode: boolean
}) {
  const t = getDestinyTheme(darkMode)
  return (
    <div className="mb-6">
      <h3 className={cn('text-xl font-semibold tracking-tight', t.heading)}>{title}</h3>
      {description && <p className={cn('text-sm mt-2 leading-relaxed max-w-2xl', t.muted)}>{description}</p>}
    </div>
  )
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  darkMode,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  darkMode: boolean
  label?: string
}) {
  const t = getDestinyTheme(darkMode)
  return (
    <div className="space-y-2">
      {label && <p className={cn('text-xs font-medium', t.caption)}>{label}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={destinyChip(value === opt.value, darkMode)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function LoadingBlock({ darkMode, label = 'Loading…' }: { darkMode: boolean; label?: string }) {
  const t = getDestinyTheme(darkMode)
  return (
    <div className={cn('rounded-[1.25rem] p-10 text-center', t.glass)}>
      <div className="mx-auto w-8 h-8 rounded-full border-2 border-white/20 border-t-white/70 animate-spin mb-3" />
      <p className={cn('text-sm', t.muted)}>{label}</p>
    </div>
  )
}

export function EmptyBlock({
  darkMode,
  message,
  hint,
}: {
  darkMode: boolean
  message: string
  hint?: string
}) {
  const t = getDestinyTheme(darkMode)
  return (
    <div className={cn('rounded-2xl p-10 text-center', t.glassInset)}>
      <div className="mx-auto w-12 h-12 rounded-2xl bg-white/[0.06] flex items-center justify-center mb-4">
        <Inbox className="w-6 h-6 text-white/30" />
      </div>
      <p className={cn('text-sm font-medium', t.body)}>{message}</p>
      {hint && <p className={cn('text-xs mt-2 leading-relaxed max-w-xs mx-auto', t.muted)}>{hint}</p>}
    </div>
  )
}

function LeaderboardRow({
  entry,
  compact,
  darkMode,
}: {
  entry: LeaderboardEntry
  compact?: boolean
  darkMode: boolean
}) {
  const t = getDestinyTheme(darkMode)
  const medal =
    entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : String(entry.rank)

  return (
    <div
      className={cn(
        'flex items-center gap-3 py-3 px-3 rounded-2xl transition-colors',
        darkMode ? 'hover:bg-white/[0.04]' : 'hover:bg-black/[0.03]'
      )}
    >
      <span className={cn('w-8 text-center text-sm font-semibold shrink-0', entry.rank <= 3 ? t.gold : t.caption)}>
        {medal}
      </span>
      {entry.emblemUrl ? (
        <img src={entry.emblemUrl} alt="" className="w-10 h-10 rounded-full ring-1 ring-white/10 shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-white/[0.06] shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={cn('font-medium text-sm truncate', t.heading)}>{entry.bungieDisplayName}</p>
        {!compact && (
          <p className={cn('text-xs mt-0.5 truncate', t.muted)}>
            {entry.clanTag ? `${entry.clanTag} · ` : ''}
            {platformIcon(entry.platform)}
            {entry.powerLevel ? ` · ${entry.powerLevel} PL` : ''}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className={cn('text-sm font-semibold tabular-nums', t.gold)}>{entry.points}</p>
        <p className={cn('text-[10px]', t.caption)}>pts</p>
      </div>
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
  if (!entries.length) {
    return (
      <EmptyBlock
        darkMode={darkMode}
        message="No entries yet"
        hint="Sync your Bungie runs from Home to appear on the board."
      />
    )
  }

  return (
    <div className="space-y-0.5 -mx-1">
      {entries.map((e) => (
        <LeaderboardRow key={`${e.userId}-${e.rank}`} entry={e} compact={compact} darkMode={darkMode} />
      ))}
    </div>
  )
}

export function StatusPill({
  label,
  tone,
}: {
  label: string
  tone: 'gold' | 'purple' | 'blue' | 'red' | 'green' | 'neutral'
}) {
  const tones = {
    gold: 'bg-amber-400/10 text-amber-200/90 ring-amber-400/20',
    purple: 'bg-violet-400/10 text-violet-200/90 ring-violet-400/20',
    blue: 'bg-sky-400/10 text-sky-200/90 ring-sky-400/20',
    red: 'bg-red-400/10 text-red-200/90 ring-red-400/20',
    green: 'bg-emerald-400/10 text-emerald-200/90 ring-emerald-400/20',
    neutral: 'bg-white/[0.06] text-white/70 ring-white/10',
  }
  return (
    <span className={cn('text-xs px-3 py-1 rounded-full ring-1 font-medium', tones[tone])}>{label}</span>
  )
}
