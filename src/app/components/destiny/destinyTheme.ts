/** DestinyTopNest visual theme — calm, spacious, Apple-inspired. */

import { cn } from '@/lib/utils'

export function getDestinyTheme(darkMode: boolean) {
  const shell = darkMode
    ? 'bg-[#0f1117] min-h-[480px]'
    : 'bg-slate-100 min-h-[480px]'

  const glass = darkMode
    ? 'bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.24)]'
    : 'bg-white/80 backdrop-blur-xl border border-black/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.08)]'

  const glassInset = darkMode
    ? 'bg-black/20 border border-white/[0.05]'
    : 'bg-black/[0.03] border border-black/[0.05]'

  const gold = 'text-amber-300/90'
  const purple = 'text-violet-300/90'
  const blue = 'text-sky-300/90'
  const muted = darkMode ? 'text-white/50' : 'text-slate-500'
  const body = darkMode ? 'text-white/80' : 'text-slate-700'
  const heading = darkMode ? 'text-white' : 'text-slate-900'
  const caption = darkMode ? 'text-white/40' : 'text-slate-400'
  const accentBorder = 'border-white/10'

  return {
    shell,
    glass,
    glassInset,
    gold,
    purple,
    blue,
    muted,
    body,
    heading,
    caption,
    accentBorder,
  }
}

export function destinyNavPrimary(active: boolean, darkMode: boolean) {
  return cn(
    'flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200',
    active
      ? darkMode
        ? 'bg-white text-[#0f1117] shadow-lg shadow-black/20'
        : 'bg-slate-900 text-white shadow-md'
      : darkMode
        ? 'text-white/60 hover:text-white/90 hover:bg-white/[0.06]'
        : 'text-slate-500 hover:text-slate-800 hover:bg-black/[0.04]'
  )
}

export function destinyNavSecondary(active: boolean, darkMode: boolean) {
  return cn(
    'flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200',
    active
      ? darkMode
        ? 'bg-white/15 text-white ring-1 ring-white/20'
        : 'bg-slate-900/10 text-slate-900 ring-1 ring-slate-900/10'
      : darkMode
        ? 'text-white/45 hover:text-white/75 hover:bg-white/[0.05]'
        : 'text-slate-500 hover:text-slate-700 hover:bg-black/[0.04]'
  )
}

export function destinyChip(active: boolean, darkMode: boolean) {
  return cn(
    'px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200',
    active
      ? darkMode
        ? 'bg-white/14 text-white'
        : 'bg-slate-900 text-white'
      : darkMode
        ? 'bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white/80'
        : 'bg-black/[0.04] text-slate-600 hover:bg-black/[0.07]'
  )
}

export function destinyPrimaryBtn(darkMode: boolean) {
  return cn(
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200',
    'active:scale-[0.98]',
    darkMode
      ? 'bg-white text-[#0f1117] hover:bg-white/90 shadow-lg shadow-black/25'
      : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md'
  )
}

export function destinySecondaryBtn(darkMode: boolean) {
  return cn(
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-200',
    darkMode
      ? 'bg-white/[0.08] text-white/90 hover:bg-white/[0.12] ring-1 ring-white/10'
      : 'bg-black/[0.05] text-slate-800 hover:bg-black/[0.08] ring-1 ring-black/[0.06]'
  )
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function platformIcon(platform: string): string {
  switch (platform) {
    case 'xbox':
      return 'Xbox'
    case 'playstation':
      return 'PS'
    case 'steam':
      return 'Steam'
    case 'crossplay':
      return 'Cross'
    default:
      return platform.slice(0, 4)
  }
}
