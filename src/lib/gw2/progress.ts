import type { Gw2ResourceKind, HeroPoint, HeroPointFilter } from './types'
import { GW2_RESOURCE_KINDS } from './types'

export function parseHeroPointIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < raw.length; i += 1) {
    const id = typeof raw[i] === 'string' ? raw[i].trim() : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function unionHeroPointIds(lists: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>()
  for (let i = 0; i < lists.length; i += 1) {
    const list = lists[i]
    for (let j = 0; j < list.length; j += 1) seen.add(list[j])
  }
  return Array.from(seen)
}

export function completedSet(ids: readonly string[]): Set<string> {
  return new Set(ids)
}

export function parseMasteryUnlocked(raw: unknown): string[] {
  const unlocked =
    raw && typeof raw === 'object' && Array.isArray((raw as { unlocked?: unknown }).unlocked)
      ? ((raw as { unlocked: unknown[] }).unlocked)
      : []
  const out: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < unlocked.length; i += 1) {
    const id = Number(unlocked[i])
    if (!Number.isFinite(id)) continue
    const key = `mastery-${id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

export function emptyKindCounts(): Record<Gw2ResourceKind, { total: number; completed: number; trackable: number }> {
  const counts = {} as Record<Gw2ResourceKind, { total: number; completed: number; trackable: number }>
  for (let i = 0; i < GW2_RESOURCE_KINDS.length; i += 1) {
    counts[GW2_RESOURCE_KINDS[i]] = { total: 0, completed: 0, trackable: 0 }
  }
  return counts
}

export function countByKind(
  points: readonly HeroPoint[],
  completed: ReadonlySet<string>
): Record<Gw2ResourceKind, { total: number; completed: number; trackable: number }> {
  const counts = emptyKindCounts()
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i]
    const row = counts[point.kind]
    row.total += 1
    if (point.trackable) row.trackable += 1
    if (point.trackable && completed.has(point.id)) row.completed += 1
  }
  return counts
}

export function matchesResourceQuery(point: HeroPoint, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    point.name.toLowerCase().includes(q) ||
    point.mapName.toLowerCase().includes(q) ||
    point.regionName.toLowerCase().includes(q) ||
    point.expansion.toLowerCase().includes(q) ||
    point.id.toLowerCase().includes(q) ||
    (point.nearby ? point.nearby.toLowerCase().includes(q) : false)
  )
}

export function filterMapResources(
  points: readonly HeroPoint[],
  completed: ReadonlySet<string>,
  options: {
    filter: HeroPointFilter
    kinds: ReadonlySet<Gw2ResourceKind>
    expansion?: string
    query?: string
  }
): HeroPoint[] {
  const expansion = (options.expansion || '').trim()
  const query = options.query || ''
  return points.filter((point) => {
    if (!options.kinds.has(point.kind)) return false
    if (expansion && expansion !== 'all' && point.expansion !== expansion) return false
    if (!matchesResourceQuery(point, query)) return false
    const done = point.trackable && completed.has(point.id)
    if (options.filter === 'completed') return done
    if (options.filter === 'incomplete') return point.trackable && !done
    if (options.filter === 'untracked') return !point.trackable
    return true
  })
}

export function filterHeroPoints(
  points: readonly HeroPoint[],
  completed: ReadonlySet<string>,
  filter: HeroPointFilter
): HeroPoint[] {
  return filterMapResources(points, completed, {
    filter,
    kinds: new Set(GW2_RESOURCE_KINDS),
  })
}

export function uniqueExpansions(points: readonly HeroPoint[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (let i = 0; i < points.length; i += 1) {
    const name = points[i].expansion
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out.sort((a, b) => a.localeCompare(b))
}
