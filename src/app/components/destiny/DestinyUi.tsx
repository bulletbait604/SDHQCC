'use client'

import { cn } from '@/lib/utils'
import type { DestinyIconRef, LeaderboardEntry } from '@/lib/destiny/types'
import { TopNestLogoMark } from '@/app/components/destiny/TopNestBrandBanner'
import {
  destinyChip,
  elementBorderClass,
  formatDuration,
  getDestinyTheme,
  platformIcon,
  tierBorderClass,
} from '@/app/components/destiny/destinyTheme'

export function ItemIcon({
  item,
  name,
  iconUrl,
  size = 40,
  className,
  title,
  square = true,
}: {
  item?: DestinyIconRef
  name?: string
  iconUrl?: string
  size?: number
  className?: string
  title?: string
  /** Square corners like light.gg item tiles (default). Set false for circular class icons. */
  square?: boolean
}) {
  const url = item?.iconUrl ?? iconUrl
  const label = item?.name ?? name ?? 'Item'
  const tier = item?.tierLabel
  const rarityClass = tierBorderClass(tier)
  const elementClass = elementBorderClass(label)

  if (url) {
    return (
      <img
        src={url}
        alt=""
        title={title ?? (tier ? `${label} (${tier})` : label)}
        className={cn(
          'd2-item-thumb',
          square ? 'rounded-sm' : 'rounded-full',
          rarityClass,
          elementClass,
          className
        )}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      title={label}
      className={cn(
        'd2-item-thumb d2-rarity-common flex items-center justify-center text-[10px] text-white/30',
        square ? 'rounded-sm' : 'rounded-full',
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
    <div className="flex flex-wrap gap-2 items-start">
      {items.filter(Boolean).map((item, i) => (
        <div key={i} className="flex flex-col items-center gap-1 max-w-[76px]">
          <ItemIcon item={item} size={size} />
          <span className={cn('text-[9px] text-center line-clamp-2 leading-snug', t.caption)}>
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
    <div className="flex items-center gap-2.5">
      <ItemIcon item={classRef} name={characterClass} size={36} square={false} />
      <ItemIcon item={subclassRef} name={subclass} size={32} />
      <span className={cn('text-sm font-semibold', t.body)}>
        <span className={cn('uppercase tracking-wide text-[11px]', t.gold)}>{subclass}</span>
        <span className={cn('mx-1.5 text-white/25')}>·</span>
        <span className="capitalize">{characterClass}</span>
      </span>
    </div>
  )
}

export function ActivityBadge({
  activityRef,
  name,
  darkMode,
  size = 52,
}: {
  activityRef?: DestinyIconRef
  name: string
  darkMode: boolean
  size?: number
}) {
  const t = getDestinyTheme(darkMode)
  return (
    <div className="flex items-center gap-3 d2-panel-inset px-3 py-2 rounded-lg">
      {activityRef?.iconUrl ? (
        <img
          src={activityRef.iconUrl}
          alt=""
          className="d2-item-thumb d2-rarity-legendary rounded-sm shrink-0 object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="d2-item-thumb d2-rarity-legendary rounded-sm shrink-0 bg-black/40"
          style={{ width: size, height: size }}
        />
      )}
      <span className={cn('font-black text-xs tracking-[0.08em] uppercase', t.heading)}>{name}</span>
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
    <div className={cn(pad, t.glass, className)}>{children}</div>
  )
}

export function SectionTitle({
  title,
  subtitle,
  iconUrl,
  darkMode,
}: {
  title: string
  subtitle?: string
  iconUrl?: string
  darkMode: boolean
}) {
  return (
    <div className="d2-panel-header">
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          className="d2-item-thumb d2-rarity-legendary rounded-sm shrink-0 w-11 h-11 object-cover"
        />
      ) : null}
      <div>
        <h4 className="d2-panel-header-title">{title}</h4>
        {subtitle && <p className="d2-panel-header-sub">{subtitle}</p>}
      </div>
    </div>
  )
}

/** Tracker.gg-style stat highlight card. */
export function StatCard({
  label,
  value,
  sub,
  darkMode,
}: {
  label: string
  value: React.ReactNode
  sub?: string
  darkMode: boolean
}) {
  const t = getDestinyTheme(darkMode)
  return (
    <div className="d2-stat-card">
      <p className="d2-stat-card-label">{label}</p>
      <p className="d2-stat-card-value">{value}</p>
      {sub ? <p className={cn('text-[11px] mt-1.5', t.muted)}>{sub}</p> : null}
    </div>
  )
}

/** Blueberries.gg-style reset countdown. */
export function ResetCountdown({
  days,
  hours,
  minutes,
  seconds,
  label = 'Weekly reset',
}: {
  days: number
  hours: number
  minutes: number
  seconds?: number
  label?: string
}) {
  const units = [
    { n: days, l: 'Days' },
    { n: hours, l: 'Hrs' },
    { n: minutes, l: 'Min' },
    ...(seconds != null ? [{ n: seconds, l: 'Sec' }] : []),
  ]

  return (
    <div>
      <p className="d2-panel-header-title text-xs mb-3">{label}</p>
      <div className={cn('d2-countdown', seconds == null && 'grid-cols-3')}>
        {units.map(({ n, l }) => (
          <div key={l} className="d2-countdown-unit">
            <p className="d2-countdown-num">{n}</p>
            <p className="d2-countdown-lbl">{l}</p>
          </div>
        ))}
      </div>
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
      <h3 className={cn('text-xl font-black tracking-tight uppercase', t.heading)}>{title}</h3>
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
      {label && <p className={cn('text-xs font-medium uppercase tracking-wide', t.caption)}>{label}</p>}
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
    <div className={cn('p-10 text-center', t.glass)}>
      <TopNestLogoMark size={56} className="mx-auto mb-4 animate-pulse" />
      <p className={cn('text-sm uppercase tracking-[0.15em]', t.bronze)}>{label}</p>
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
    <div className={cn('rounded-lg p-10 text-center', t.glassInset)}>
      <TopNestLogoMark size={48} className="mx-auto mb-4 opacity-60" />
      <p className={cn('text-sm font-semibold', t.body)}>{message}</p>
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

  return (
    <div className="d2-leaderboard-row">
      <span
        className={cn(
          'd2-leaderboard-rank',
          entry.rank <= 3 ? 'd2-leaderboard-rank-top' : t.caption
        )}
      >
        {entry.rank}
      </span>
      {entry.emblemUrl ? (
        <img
          src={entry.emblemUrl}
          alt=""
          className="w-10 h-10 rounded-sm shrink-0 object-cover ring-1 ring-white/15"
        />
      ) : (
        <div className="w-10 h-10 rounded-sm bg-black/40 shrink-0 ring-1 ring-white/10" />
      )}
      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold text-sm truncate', t.heading)}>{entry.bungieDisplayName}</p>
        {!compact && (
          <p className={cn('text-[11px] mt-0.5 truncate', t.muted)}>
            {entry.clanTag ? `${entry.clanTag} · ` : ''}
            {platformIcon(entry.platform)}
            {entry.powerLevel ? ` · ${entry.powerLevel} PL` : ''}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="d2-stat-card-value text-base">{entry.points}</p>
        <p className={cn('text-[9px] uppercase tracking-wide', t.caption)}>pts</p>
        {!compact && entry.reputationScore != null && entry.reputationScore > 0 && (
          <p className={cn('text-[10px] mt-0.5', t.muted)}>
            ★ {entry.reputationScore.toFixed(1)}
            {entry.reputationReviewCount ? ` (${entry.reputationReviewCount})` : ''}
          </p>
        )}
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
    <div className="-mx-1">
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
    gold: 'd2-badge-gold',
    purple: 'd2-badge-purple',
    blue: 'd2-badge-blue',
    red: 'd2-badge-red',
    green: 'd2-badge-green',
    neutral: 'd2-badge-neutral',
  }
  return <span className={cn('d2-badge-pill', tones[tone])}>{label}</span>
}
