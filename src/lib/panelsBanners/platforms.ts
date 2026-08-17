/**
 * P&B's — saved platform banner + panel sizes.
 *
 * These are hardcoded from official docs / platform help (researched Aug 2026).
 * Do NOT call an LLM to "look up" sizes at runtime — use this table only.
 *
 * Kick (official Help Center https://help.kick.com/en/articles/7120563-how-to-update-your-profile):
 *   - Profile banner image (channel top): min 1280×700, max 4MB
 *   - Channel offline banner (player when stream ended): 1920×1080, max 4MB
 *   - Panels: Kick does not publish exact px; community standard matches Twitch — 320px wide, height flexible
 *
 * Twitch (creator brand / Streamlabs / Stream Scheme consensus + Twitch channel brand settings):
 *   - Profile banner: 1200×480
 *   - Video player offline banner: 1920×1080, max ~10MB
 *   - Panels: max width 320px, height flexible (often up to ~600); file usually &lt;1MB
 *
 * YouTube (Google Help):
 *   - Channel art: recommended 2560×1440 (min 2048×1152), ≤6MB
 *   - Text/logo safe area: ~1546×423 centered (older docs also cite 1235×338 at min size)
 *   - No Twitch-style info panels
 *
 * Facebook Page / Gaming cover (Facebook Help):
 *   - Cover upload that loads fastest: 851×315; min 400×150
 *
 * Trovo:
 *   - No strong public official banner px doc; offline/player graphics follow 1920×1080 stream canvas
 *   - Panels treated like Kick/Twitch (320 wide)
 *
 * Rumble (official support):
 *   - Channel backsplash / banner: 3600×600, ≤2MB recommended
 *
 * Picarto (Help Center):
 *   - Panel images: variable resolution, ≤2.5MB; title ≤21 chars
 *   - Offline image: custom upload, no fixed official px — use 1920×1080
 */

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
  label: string
  notes?: string
  /** Max upload size hint for creators */
  maxFileMb?: number
  source?: string
}

export type PlatformSizeDefaults = {
  id: PanelsBannersPlatformId
  name: string
  /**
   * Primary "banner" we generate in this tool = offline / player / cover asset
   * (not always the thin profile header — see profileBanner when present).
   */
  banner: AssetSizeSpec
  /** Optional second official banner (e.g. Kick profile header 1280×700). */
  profileBanner?: AssetSizeSpec
  /**
   * Panel art we generate.
   * Kick + Twitch: HEADER ONLY — full panel width (320) × ~1/5 of a typical tall panel (~80).
   */
  panel: AssetSizeSpec
  panelCount: number
  panelStyle: 'header' | 'feature'
}

/** Kick/Twitch panel header: full 320px panel width, ~1/5 of a ~400px-tall info panel. */
const PANEL_HEADER_320x80: AssetSizeSpec = {
  width: 320,
  height: 80,
  label: 'Panel header',
  notes:
    'Header strip only (not a tall card). Full panel width × ~1/5 height. Bold title on designed/colored background.',
  maxFileMb: 1,
  source: 'Twitch/Kick community standard: 320px wide panels; header height ~60–100px',
}

export const PANELS_BANNERS_PLATFORMS: PlatformSizeDefaults[] = [
  {
    id: 'kick',
    name: 'KICK',
    banner: {
      width: 1920,
      height: 1080,
      label: 'Channel offline banner',
      notes:
        'Official Kick “Channel Offline Banner” — shown when the stream has ended. Must be 1920×1080.',
      maxFileMb: 4,
      source: 'Kick Help Center — How to update your profile (Channel Offline Banner)',
    },
    profileBanner: {
      width: 1280,
      height: 700,
      label: 'Profile banner image',
      notes:
        'Official Kick channel-top banner (minimum). Different from the 1920×1080 offline banner.',
      maxFileMb: 4,
      source: 'Kick Help Center — Banner Image Minimum Dimensions: 1280×700',
    },
    panel: { ...PANEL_HEADER_320x80 },
    panelCount: 3,
    panelStyle: 'header',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    banner: {
      width: 1920,
      height: 1080,
      label: 'Video player offline banner',
      notes: 'Fills the video player when offline. 16:9 full HD.',
      maxFileMb: 10,
      source: 'Twitch Creator Dashboard → Settings → Channel → Brand (video player banner)',
    },
    profileBanner: {
      width: 1200,
      height: 480,
      label: 'Profile banner',
      notes: 'Channel page header strip (separate from offline player banner).',
      maxFileMb: 10,
      source: 'Twitch brand assets — profile banner 1200×480',
    },
    panel: { ...PANEL_HEADER_320x80 },
    panelCount: 3,
    panelStyle: 'header',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    banner: {
      width: 2560,
      height: 1440,
      label: 'Channel art / banner',
      notes:
        'Recommended upload 2560×1440 (min 2048×1152). Keep critical text/logos inside ~1546×423 centered safe area.',
      maxFileMb: 6,
      source: 'YouTube Help — Manage your channel branding',
    },
    panel: {
      width: 1280,
      height: 256,
      label: 'Feature / link card header',
      notes:
        'YouTube has no Twitch-style panels — generate wide feature-card headers for links/community.',
      source: 'Product convention (YouTube has no official panel size)',
    },
    panelCount: 3,
    panelStyle: 'feature',
  },
  {
    id: 'facebook-gaming',
    name: 'Facebook Gaming',
    banner: {
      width: 851,
      height: 315,
      label: 'Page cover photo',
      notes:
        'Facebook official “loads fastest” Page cover size. Min 400×150. Profile pic overlaps left edge.',
      maxFileMb: 0.1,
      source: 'Facebook Help — Page cover photo 851×315',
    },
    panel: {
      width: 1200,
      height: 240,
      label: 'Feature header',
      notes: 'Facebook has no Twitch-style panels — generate wide feature headers.',
      source: 'Product convention',
    },
    panelCount: 3,
    panelStyle: 'feature',
  },
  {
    id: 'trovo',
    name: 'Trovo',
    banner: {
      width: 1920,
      height: 1080,
      label: 'Offline / player banner',
      notes:
        'Trovo does not publish a strong public banner px doc; 1920×1080 matches the stream canvas / offline screen practice.',
      maxFileMb: 10,
      source: 'Community practice (no official Trovo banner px in public docs)',
    },
    panel: { ...PANEL_HEADER_320x80 },
    panelCount: 3,
    panelStyle: 'header',
  },
  {
    id: 'rumble',
    name: 'Rumble',
    banner: {
      width: 3600,
      height: 600,
      label: 'Channel backsplash / banner',
      notes: 'Official Rumble backsplash 3600×600 (6:1). Keep key art centered for mobile crop.',
      maxFileMb: 2,
      source: 'Rumble Support — Channel Banner/Backsplash Dimensions',
    },
    panel: {
      width: 1200,
      height: 240,
      label: 'Feature header',
      notes: 'Rumble has no Twitch-style panels — generate wide feature headers.',
      source: 'Product convention',
    },
    panelCount: 3,
    panelStyle: 'feature',
  },
  {
    id: 'picarto',
    name: 'Picarto',
    banner: {
      width: 1920,
      height: 1080,
      label: 'Offline image',
      notes:
        'Picarto offline image has no fixed official px — 1920×1080 is the safe stream-canvas default.',
      maxFileMb: 10,
      source: 'Picarto Help — Offline Image (no fixed px); using 1080p default',
    },
    panel: {
      width: 320,
      height: 80,
      label: 'Panel header',
      notes:
        'Picarto panels are variable resolution (max 2.5MB). We generate compact 320×80 headers.',
      maxFileMb: 2.5,
      source: 'Picarto Help — panel images variable resolution, ≤2.5MB',
    },
    panelCount: 3,
    panelStyle: 'header',
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
