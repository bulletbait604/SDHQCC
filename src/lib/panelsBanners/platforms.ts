/** Streaming platforms supported by P&B's (Panels & Banners) R&D tool. */

export type PanelsBannersPlatformId =
  | 'kick'
  | 'twitch'
  | 'youtube'
  | 'facebook-gaming'
  | 'trovo'
  | 'rumble'
  | 'picarto'

export type PanelsBannersOutputMode = 'banner' | 'panels' | 'both'

export type AssetSizeSpec = {
  width: number
  height: number
  /** Human label shown in UI */
  label: string
  notes?: string
}

export type PlatformSizeDefaults = {
  id: PanelsBannersPlatformId
  name: string
  /** Offline / profile / channel banner */
  banner: AssetSizeSpec
  /** Wide short panel header strip (title bar), not a tall card */
  panel: AssetSizeSpec
  /** How many panels we generate per mockup */
  panelCount: number
}

/**
 * Conservative published defaults. Gemini research may refine these at runtime;
 * we never invent wildly different ratios without model confirmation.
 *
 * Panels are HEADER STRIPS (wide × short) — bold title on a designed background —
 * not tall info cards. Match creator channel section headers (~5:1).
 */
const PANEL_HEADER: AssetSizeSpec = {
  width: 1200,
  height: 240,
  label: 'Panel header',
  notes:
    'Wide short header strip only: designed/colored background + bold centered title. Not a tall card, not a full info panel.',
}

export const PANELS_BANNERS_PLATFORMS: PlatformSizeDefaults[] = [
  {
    id: 'kick',
    name: 'KICK',
    banner: {
      width: 1920,
      height: 480,
      label: 'Channel / profile banner',
      notes: 'Wide channel header; keep key art in the center safe area.',
    },
    panel: { ...PANEL_HEADER },
    panelCount: 3,
  },
  {
    id: 'twitch',
    name: 'Twitch',
    banner: {
      width: 1920,
      height: 1080,
      label: 'Offline screen banner',
      notes: 'Shown when the channel is offline; 16:9 full-frame.',
    },
    panel: { ...PANEL_HEADER },
    panelCount: 3,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    banner: {
      width: 2560,
      height: 1440,
      label: 'Channel art / banner',
      notes: 'Upload 2560×1440; keep critical content inside ~1546×423 TV safe area.',
    },
    panel: { ...PANEL_HEADER },
    panelCount: 3,
  },
  {
    id: 'facebook-gaming',
    name: 'Facebook Gaming',
    banner: {
      width: 1920,
      height: 1080,
      label: 'Cover / offline-style banner',
      notes: 'Landscape cover suitable for gaming page headers.',
    },
    panel: { ...PANEL_HEADER },
    panelCount: 3,
  },
  {
    id: 'trovo',
    name: 'Trovo',
    banner: {
      width: 1920,
      height: 480,
      label: 'Channel banner',
      notes: 'Wide header for the Trovo channel page.',
    },
    panel: { ...PANEL_HEADER },
    panelCount: 3,
  },
  {
    id: 'rumble',
    name: 'Rumble',
    banner: {
      width: 1920,
      height: 480,
      label: 'Channel banner',
      notes: 'Wide channel header artwork.',
    },
    panel: { ...PANEL_HEADER },
    panelCount: 3,
  },
  {
    id: 'picarto',
    name: 'Picarto',
    banner: {
      width: 1920,
      height: 480,
      label: 'Channel banner',
      notes: 'Art-stream channel header.',
    },
    panel: { ...PANEL_HEADER },
    panelCount: 3,
  },
]

export function getPanelsBannersPlatform(
  id: string
): PlatformSizeDefaults | undefined {
  return PANELS_BANNERS_PLATFORMS.find((p) => p.id === id)
}

export function isPanelsBannersPlatformId(id: string): id is PanelsBannersPlatformId {
  return PANELS_BANNERS_PLATFORMS.some((p) => p.id === id)
}

export function isPanelsBannersOutputMode(v: string): v is PanelsBannersOutputMode {
  return v === 'banner' || v === 'panels' || v === 'both'
}

/** Premade panel titles users can pick (plus custom titles in the UI). */
export const PREMADE_PANEL_TITLES = [
  'About Me',
  'PC Specs',
  'Merch',
  'Donations',
  'Commands',
  'Blerps',
  'Throne',
  'Socials',
] as const

export type PremadePanelTitle = (typeof PREMADE_PANEL_TITLES)[number]

export const MAX_PANEL_TITLES = 6
export const MAX_CUSTOM_PANEL_TITLE_CHARS = 40

export function normalizePanelTitles(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const title = item.trim().replace(/\s+/g, ' ').slice(0, MAX_CUSTOM_PANEL_TITLE_CHARS)
    if (!title) continue
    const key = title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(title)
    if (out.length >= MAX_PANEL_TITLES) break
  }
  return out
}

export function aspectRatioLabel(width: number, height: number): string {
  const g = gcd(Math.round(width), Math.round(height))
  return `${Math.round(width / g)}:${Math.round(height / g)}`
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}
