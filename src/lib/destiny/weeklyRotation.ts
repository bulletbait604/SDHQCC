/**
 * Destiny 2 weekly reset schedule (Tuesday 10:00 AM Pacific / 17:00 UTC).
 * Rotation sourced from Bungie TWID + community reset trackers (Monument of Triumph era).
 */

import type { Difficulty } from '@/lib/destiny/types'

export const WEEKLY_RESET_HOUR_UTC = 17 // 10:00 AM PDT
export const WEEKLY_RESET_DAY = 2 // Tuesday

export interface RotationWeek {
  /** ISO date (YYYY-MM-DD) of the Tuesday reset that starts this week */
  resetStart: string
  raids: [string, string]
  dungeons: [string, string]
  pantheon?: string
}

/** Featured raid/dungeon pairs by reset week (post–Monument of Triumph rotator). */
export const ROTATION_SCHEDULE: RotationWeek[] = [
  {
    resetStart: '2026-06-09',
    raids: ['Vow of the Disciple', 'Last Wish'],
    dungeons: ['Shattered Throne', 'Duality'],
    pantheon: 'Pantheon 2.0 launch',
  },
  {
    resetStart: '2026-06-16',
    raids: ['Garden of Salvation', "King's Fall"],
    dungeons: ['Spire of the Watcher', 'Pit of Heresy'],
    pantheon: 'Reprise: Gahlran · Encore: Consecrated Mind',
  },
  {
    resetStart: '2026-06-23',
    raids: ['Root of Nightmares', 'Deep Stone Crypt'],
    dungeons: ['Ghosts of the Deep', 'Duality'],
    pantheon: 'Featured single-boss encounters',
  },
  {
    resetStart: '2026-06-30',
    raids: ["Crota's End", 'Vault of Glass'],
    dungeons: ["Warlord's Ruin", 'Grasp of Avarice'],
  },
  {
    resetStart: '2026-07-07',
    raids: ['Salvation\'s Edge', 'Crown of Sorrow'],
    dungeons: ['Vesper\'s Host', 'Prophecy'],
  },
]

export interface WeeklyResetState {
  resetAt: string
  nextResetAt: string
  weekStart: string
  weekEnd: string
  weekLabel: string
  resetsInMs: number
  resetsInLabel: string
  featuredRaids: { name: string; difficulty: Difficulty }[]
  featuredDungeons: { name: string; difficulty: Difficulty }[]
  pantheon?: string
  resetTimeLabel: string
}

function parseUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T${String(WEEKLY_RESET_HOUR_UTC).padStart(2, '0')}:00:00.000Z`)
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Reset imminent'
  const totalHours = Math.floor(ms / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/** Most recent Tuesday 17:00 UTC at or before `now`. */
export function getCurrentWeekResetStart(now = new Date()): Date {
  const d = new Date(now)
  d.setUTCHours(WEEKLY_RESET_HOUR_UTC, 0, 0, 0)
  const day = d.getUTCDay()
  const diff = (day - WEEKLY_RESET_DAY + 7) % 7
  d.setUTCDate(d.getUTCDate() - diff)
  if (d.getTime() > now.getTime()) {
    d.setUTCDate(d.getUTCDate() - 7)
  }
  return d
}

export function getNextWeeklyReset(now = new Date()): Date {
  const start = getCurrentWeekResetStart(now)
  const next = new Date(start)
  next.setUTCDate(next.getUTCDate() + 7)
  return next
}

function weekEntryForDate(resetStart: Date): RotationWeek {
  const key = resetStart.toISOString().slice(0, 10)
  const exact = ROTATION_SCHEDULE.find((w) => w.resetStart === key)
  if (exact) return exact

  let chosen = ROTATION_SCHEDULE[0]
  for (const week of ROTATION_SCHEDULE) {
    if (week.resetStart <= key) chosen = week
    else break
  }
  return chosen
}

export function getWeeklyResetState(now = new Date()): WeeklyResetState {
  const weekStartDate = getCurrentWeekResetStart(now)
  const nextResetDate = getNextWeeklyReset(now)
  const weekEndDate = new Date(nextResetDate)
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() - 1)

  const entry = weekEntryForDate(weekStartDate)
  const resetsInMs = Math.max(0, nextResetDate.getTime() - now.getTime())

  return {
    resetAt: weekStartDate.toISOString(),
    nextResetAt: nextResetDate.toISOString(),
    weekStart: weekStartDate.toISOString().slice(0, 10),
    weekEnd: weekEndDate.toISOString().slice(0, 10),
    weekLabel: `${formatShortDate(weekStartDate)} – ${formatShortDate(weekEndDate)}`,
    resetsInMs,
    resetsInLabel: formatCountdown(resetsInMs),
    featuredRaids: entry.raids.map((name) => ({ name, difficulty: 'normal' as Difficulty })),
    featuredDungeons: entry.dungeons.map((name) => ({ name, difficulty: 'normal' as Difficulty })),
    pantheon: entry.pantheon,
    resetTimeLabel: 'Every Tuesday · 10:00 AM Pacific (17:00 UTC)',
  }
}

export function isFeaturedActivity(name: string, now = new Date()): boolean {
  const state = getWeeklyResetState(now)
  const all = [
    ...state.featuredRaids.map((r) => r.name),
    ...state.featuredDungeons.map((d) => d.name),
  ]
  return all.some((n) => n.toLowerCase() === name.toLowerCase())
}
