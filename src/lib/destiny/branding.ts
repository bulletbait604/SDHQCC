/** User-facing product names (internal route ids stay `destiny-top-nest`). */

export const BRAND_FULL = "Destiny's Top Nest"
export const BRAND_SHORT = 'Top Nest'

export const BRAND_TAGLINE =
  'Verified raid and dungeon leaderboards, fireteams, loadouts, and season prizes — built for the community.'

/** Logo assets (public/) */
export const BRAND_LOGO_PATH = '/brand/topnest-logo.png'
export const BRAND_LOGO_ALT = "Destiny's Top Nest — community Guardian hub"

/**
 * Palette extracted from the Top Nest crest logo:
 * bronze frame, silver type, arc blue + solar gold energy split.
 */
export const TOPNEST_BRAND = {
  bg: '#121418',
  bgElevated: '#1a1d24',
  bronze: '#a8775a',
  bronzeDark: '#5e3a24',
  bronzeLight: '#c9956e',
  silver: '#c8cdd4',
  silverBright: '#e8ecf0',
  arc: '#73d2ff',
  arcGlow: 'rgba(115, 210, 255, 0.35)',
  solar: '#ffd580',
  solarGlow: 'rgba(255, 213, 128, 0.35)',
  power: '#f5dc56',
} as const
