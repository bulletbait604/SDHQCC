/** DestinyTopNest visual theme — game-inspired, icon-forward. */

import { cn } from '@/lib/utils'

/** D2 armor stat colors (Health, Melee, Grenade, Super, Class, Weapons). */
export const D2_STAT_COLORS = {
  Resilience: '#e74c3c',
  Strength: '#e67e22',
  Discipline: '#f1c40f',
  Intellect: '#9b59b6',
  Mobility: '#3498db',
  Recovery: '#2ecc71',
} as const

export function tierGlowClass(tierLabel?: string): 'gold' | 'arc' | 'void' | 'solar' | 'neutral' {
  const tier = (tierLabel ?? '').toLowerCase()
  if (tier.includes('exotic')) return 'gold'
  if (tier.includes('legendary')) return 'void'
  if (tier.includes('rare')) return 'arc'
  return 'neutral'
}

export function getDestinyTheme(darkMode: boolean) {
  const shell = darkMode
    ? 'd2-atmosphere min-h-[480px]'
    : 'bg-gradient-to-br from-slate-100 via-violet-50/30 to-slate-100 min-h-[480px]'

  const glass = darkMode
    ? 'd2-game-card bg-[#12151f]/80 backdrop-blur-xl border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.45)]'
    : 'bg-white/90 backdrop-blur-xl border border-violet-200/40 shadow-[0_12px_40px_rgba(88,28,135,0.12)]'

  const glassInset = darkMode
    ? 'bg-black/30 border border-white/[0.06] shadow-inner'
    : 'bg-black/[0.03] border border-black/[0.05]'

  const gold = 'text-amber-300'
  const purple = 'text-violet-300'
  const blue = 'text-sky-300'
  const muted = darkMode ? 'text-white/55' : 'text-slate-500'
  const body = darkMode ? 'text-white/85' : 'text-slate-700'
  const heading = darkMode ? 'text-white' : 'text-slate-900'
  const caption = darkMode ? 'text-white/45' : 'text-slate-400'
  const accentBorder = 'border-white/12'

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
    'flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200',
    active
      ? 'd2-nav-btn-active scale-[1.02]'
      : darkMode
        ? 'text-white/55 hover:text-white hover:bg-white/[0.07]'
        : 'text-slate-500 hover:text-slate-900 hover:bg-black/[0.04]'
  )
}

export function destinyNavSecondary(active: boolean, darkMode: boolean) {
  return cn(
    'flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap transition-all duration-200 min-w-[64px]',
    active
      ? 'd2-nav-btn-active'
      : darkMode
        ? 'text-white/45 hover:text-white/80 hover:bg-white/[0.06]'
        : 'text-slate-500 hover:text-slate-700 hover:bg-black/[0.04]'
  )
}

export function destinyChip(active: boolean, darkMode: boolean) {
  return cn(
    'px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 shadow-md',
    active
      ? 'd2-nav-btn-active'
      : darkMode
        ? 'bg-white/[0.05] text-white/60 hover:bg-white/[0.1] hover:text-white/90 hover:shadow-lg'
        : 'bg-black/[0.04] text-slate-600 hover:bg-black/[0.07] shadow-sm'
  )
}

export function destinyPrimaryBtn(darkMode: boolean) {
  return cn(
    'inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl text-sm font-bold uppercase tracking-wide transition-all duration-200',
    'active:scale-[0.97] hover:scale-[1.02]',
    'd2-btn-primary shadow-[0_8px_24px_rgba(251,191,36,0.25)] hover:shadow-[0_12px_32px_rgba(251,191,36,0.35)]',
    darkMode ? 'text-[#0f1117]' : 'text-[#0f1117]'
  )
}

export function destinySecondaryBtn(darkMode: boolean) {
  return cn(
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200',
    'hover:scale-[1.02] active:scale-[0.98]',
    darkMode
      ? 'bg-white/[0.08] text-white/90 hover:bg-white/[0.14] ring-1 ring-white/15 shadow-lg shadow-black/20'
      : 'bg-black/[0.05] text-slate-800 hover:bg-black/[0.08] ring-1 ring-black/[0.08] shadow-md'
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

/** Subclass element glow for ability rows. */
export function subclassGlow(subclass?: string): 'arc' | 'void' | 'solar' | 'strand' | 'stasis' | 'gold' {
  const s = (subclass ?? '').toLowerCase()
  if (s.includes('arc')) return 'arc'
  if (s.includes('void')) return 'void'
  if (s.includes('solar') || s.includes('hammer')) return 'solar'
  if (s.includes('strand')) return 'strand'
  if (s.includes('stasis')) return 'stasis'
  return 'gold'
}
