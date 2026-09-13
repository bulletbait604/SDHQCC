const EXPANSIONS: Record<string, string> = {
  '0': 'Core Tyria',
  '1': 'Heart of Thorns',
  '2': 'Path of Fire',
  '3': 'Icebrood Saga',
  '4': 'End of Dragons',
  '5': 'Secrets of the Obscure',
  '6': 'Janthir Wilds',
}

export function expansionFromChallengeId(id: string): string {
  const prefix = (id.split('-')[0] || '').trim()
  return EXPANSIONS[prefix] || `Expansion ${prefix || '?'}`
}

export function expansionFromRegion(regionName: string, challengeId: string): string {
  if (challengeId && !challengeId.startsWith('coord-')) return expansionFromChallengeId(challengeId)
  const n = regionName.toLowerCase()
  if (n.includes('heart of maguuma')) return 'Heart of Thorns'
  if (n.includes('crystal desert') || n.includes('elona')) return 'Path of Fire'
  if (n.includes('bjora') || n.includes('drizzlewood') || n.includes('icebrood')) return 'Icebrood Saga'
  if (n.includes('cantha') || n.includes('jade sea') || n.includes('echovald') || n.includes('gyala')) {
    return 'End of Dragons'
  }
  if (n.includes('horn of maguuma')) return 'Secrets of the Obscure'
  if (n.includes('janthir')) return 'Janthir Wilds'
  if (n.includes('castora')) return 'Castora'
  return 'Tyria'
}

export function heroPointTitle(point: { mapName: string; nearby: string | null; id: string }): string {
  if (point.nearby) return `${point.nearby} (${point.mapName})`
  return `${point.mapName} hero challenge`
}

function dist2(a: readonly number[], b: readonly number[]): number {
  const dx = (a[0] || 0) - (b[0] || 0)
  const dy = (a[1] || 0) - (b[1] || 0)
  return dx * dx + dy * dy
}

export function nearestLandmarkName(
  coord: readonly number[],
  pois: unknown,
  maxDist = 2500
): string | null {
  if (!pois || typeof pois !== 'object') return null
  let best: string | null = null
  let bestD = maxDist * maxDist
  const values = Object.values(pois as Record<string, unknown>)
  for (let i = 0; i < values.length; i += 1) {
    const poi = values[i]
    if (!poi || typeof poi !== 'object') continue
    const row = poi as { name?: unknown; type?: unknown; coord?: unknown }
    if (row.type !== 'landmark') continue
    if (typeof row.name !== 'string' || !row.name.trim()) continue
    if (!Array.isArray(row.coord) || row.coord.length < 2) continue
    const d = dist2(coord, row.coord as number[])
    if (d < bestD) {
      bestD = d
      best = row.name.trim()
    }
  }
  return best
}

