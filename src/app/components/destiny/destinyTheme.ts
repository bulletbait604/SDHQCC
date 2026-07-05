/** DestinyTopNest visual theme — game-inspired, icon-forward. */

import { cn } from '@/lib/utils'

/** Destiny Item Manager palette — character tiles, power, accents. */
export const DIM_COLORS = {
  power: '#f5dc56',
  accent: '#e8a534',
  sealTitle: '#e1c2ec',
  gildedTitle: '#f9deb8',
  headerBg: '#313233',
  tileBorder: 'rgba(0, 0, 0, 0.3)',
} as const

/** light.gg / in-game item rarity borders. */
export const D2_RARITY = {
  common: '#dcdcdc',
  uncommon: '#366e42',
  rare: '#5076a3',
  legendary: '#513065',
  exotic: '#c3a019',
} as const

/** Element damage colors — blueberries / light.gg / in-game. */
export const D2_ELEMENTS = {
  kinetic: '#e8e8e8',
  arc: '#79bbe8',
  solar: '#f0631e',
  void: '#8e749e',
  stasis: '#4d88ff',
  strand: '#35e366',
  prismatic: '#e3619b',
} as const

/** Site-inspired surface colors (Tracker.gg, light.gg dark mode). */
export const D2_SURFACES = {
  appBg: '#0d0f14',
  panel: '#161920',
  panelRaised: '#1e222c',
  panelBorder: 'rgba(255, 255, 255, 0.06)',
  heroOverlay: 'linear-gradient(180deg, rgba(13,15,20,0.3) 0%, rgba(13,15,20,0.95) 100%)',
} as const

/** Class accent when emblem art is missing (DIM-style muted tints). */
export const DIM_CLASS_COLORS: Record<'titan' | 'hunter' | 'warlock', string> = {
  titan: '#8b2c2c',
  hunter: '#2d6b3a',
  warlock: '#5a3d8f',
}

/** D2 armor stat colors (Health, Melee, Grenade, Super, Class, Weapons). */
export const D2_STAT_COLORS = {
  Resilience: '#e74c3c',
  Strength: '#e67e22',
  Discipline: '#f1c40f',
  Intellect: '#9b59b6',
  Mobility: '#3498db',
  Recovery: '#2ecc71',
} as const

export function tierBorderClass(tierLabel?: string): string {
  const tier = (tierLabel ?? '').toLowerCase()
  if (tier.includes('exotic')) return 'd2-rarity-exotic'
  if (tier.includes('legendary')) return 'd2-rarity-legendary'
  if (tier.includes('rare')) return 'd2-rarity-rare'
  if (tier.includes('uncommon')) return 'd2-rarity-uncommon'
  return 'd2-rarity-common'
}

export function elementFromLabel(label?: string): keyof typeof D2_ELEMENTS | null {
  const s = (label ?? '').toLowerCase()
  if (s.includes('arc')) return 'arc'
  if (s.includes('solar') || s.includes('fire') || s.includes('hammer')) return 'solar'
  if (s.includes('void')) return 'void'
  if (s.includes('stasis') || s.includes('shade')) return 'stasis'
  if (s.includes('strand')) return 'strand'
  if (s.includes('prismatic')) return 'prismatic'
  if (s.includes('kinetic')) return 'kinetic'
  return null
}

export function elementBorderClass(label?: string): string {
  const el = elementFromLabel(label)
  return el ? `d2-element-${el}` : ''
}

export function tierGlowClass(tierLabel?: string): 'gold' | 'arc' | 'void' | 'solar' | 'neutral' {
  const tier = (tierLabel ?? '').toLowerCase()
  if (tier.includes('exotic')) return 'gold'
  if (tier.includes('legendary')) return 'void'
  if (tier.includes('rare')) return 'arc'
  return 'neutral'
}

export function getDestinyTheme(darkMode: boolean) {
  const shell = darkMode
    ? 'd2-atmosphere tn-brand-scope min-h-[480px]'
    : 'bg-gradient-to-br from-stone-100 via-amber-50/20 to-slate-100 min-h-[480px] tn-brand-scope'

  const glass = darkMode
    ? 'd2-panel'
    : 'bg-white/90 backdrop-blur-xl border border-amber-200/30 shadow-[0_12px_40px_rgba(94,58,36,0.1)]'

  const glassInset = darkMode
    ? 'd2-panel-inset'
    : 'bg-black/[0.03] border border-black/[0.05]'

  const gold = 'text-[var(--tn-solar)]'
  const purple = 'text-violet-300'
  const blue = 'text-[var(--tn-arc)]'
  const bronze = 'text-[var(--tn-bronze-light)]'
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
    bronze,
    muted,
    body,
    heading,
    caption,
    accentBorder,
  }
}

export function destinyNavPrimary(active: boolean, darkMode: boolean) {
  return cn(
    'd2-tab flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-all duration-200',
    active && 'd2-tab-active',
    !active && (darkMode ? 'text-white/50 hover:text-white/90' : 'text-slate-500 hover:text-slate-900')
  )
}

export function destinyNavSecondary(active: boolean, darkMode: boolean) {
  return cn(
    'd2-tab d2-tab-secondary flex flex-col items-center gap-1 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap transition-all duration-200 min-w-[64px]',
    active && 'd2-tab-active',
    !active && (darkMode ? 'text-white/40 hover:text-white/75' : 'text-slate-500 hover:text-slate-700')
  )
}

export function destinyChip(active: boolean, darkMode: boolean) {
  return cn(
    'd2-filter-chip px-4 py-2 text-sm font-semibold transition-all duration-200',
    active && 'd2-filter-chip-active',
    !active &&
      (darkMode
        ? 'text-white/55 hover:text-white/90 hover:bg-white/[0.06]'
        : 'text-slate-600 hover:bg-black/[0.05]')
  )
}

export function destinyPrimaryBtn(darkMode: boolean) {
  return cn(
    'd2-btn d2-btn-primary inline-flex items-center justify-center gap-2.5 px-6 py-3 text-sm font-bold uppercase tracking-wide transition-all duration-200',
    'active:scale-[0.97] hover:scale-[1.02]',
    darkMode ? 'text-[#0f1117]' : 'text-[#0f1117]'
  )
}

export function destinySecondaryBtn(darkMode: boolean) {
  return cn(
    'd2-btn d2-btn-secondary inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all duration-200',
    'hover:scale-[1.02] active:scale-[0.98]',
    darkMode ? 'text-white/90' : 'text-slate-800'
  )
}

export function destinyGhostBtn(darkMode: boolean) {
  return cn(
    'd2-btn d2-btn-ghost inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all duration-200',
    darkMode ? 'text-white/70 hover:text-white' : 'text-slate-600 hover:text-slate-900'
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
