/** Bungie CDN URL helpers (safe for client or server). */

export function buildBungieIconUrl(iconPath: string | undefined | null): string | undefined {
  if (!iconPath) return undefined
  if (iconPath.startsWith('http')) return iconPath
  return `https://www.bungie.net${iconPath.startsWith('/') ? '' : '/'}${iconPath}`
}
