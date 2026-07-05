/** DestinyTopNest visual theme tokens. */

export function getDestinyTheme(darkMode: boolean) {
  const shell = darkMode
    ? 'bg-gradient-to-b from-[#0a0e1a] via-[#0d1224] to-[#0a0e1a]'
    : 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900'

  const glass = darkMode
    ? 'bg-white/5 backdrop-blur-md border border-white/10 shadow-lg shadow-purple-900/10'
    : 'bg-white/10 backdrop-blur-md border border-white/15'

  const gold = 'text-amber-400'
  const purple = 'text-purple-400'
  const blue = 'text-sky-400'
  const muted = darkMode ? 'text-gray-400' : 'text-gray-300'
  const heading = 'text-white'
  const accentBorder = 'border-amber-500/30'

  return { shell, glass, gold, purple, blue, muted, heading, accentBorder }
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
