import { expansionFromRegion, nearestLandmarkName } from './skillChallenges'
import type { Gw2ResourceKind, HeroPoint } from './types'

function readList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[]
  if (raw && typeof raw === 'object') return Object.values(raw as Record<string, T>)
  return []
}

function coordOf(raw: unknown): [number, number] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null
  const x = Number(raw[0])
  const y = Number(raw[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return [x, y]
}

function resourceName(kind: Gw2ResourceKind, fallback: string, nearby: string | null, mapName: string): string {
  if (kind === 'hero_point') {
    if (nearby) return `${nearby} (${mapName})`
    return fallback
  }
  if (nearby && !fallback.toLowerCase().includes(nearby.toLowerCase())) {
    return `${fallback} · ${nearby}`
  }
  return fallback
}

export function collectMapResources(floor: unknown): HeroPoint[] {
  const byId = new Map<string, HeroPoint>()
  if (!floor || typeof floor !== 'object') return []
  const regions = (floor as { regions?: Record<string, unknown> }).regions || {}
  const regionIds = Object.keys(regions)

  const add = (point: HeroPoint) => {
    const prev = byId.get(point.id)
    if (!prev || (!prev.nearby && point.nearby)) byId.set(point.id, point)
  }

  for (let r = 0; r < regionIds.length; r += 1) {
    const region = regions[regionIds[r]]
    if (!region || typeof region !== 'object') continue
    const regionName =
      typeof (region as { name?: unknown }).name === 'string'
        ? (region as { name: string }).name
        : 'Unknown region'
    const maps = (region as { maps?: Record<string, unknown> }).maps || {}
    const mapIds = Object.keys(maps)
    for (let m = 0; m < mapIds.length; m += 1) {
      const map = maps[mapIds[m]]
      if (!map || typeof map !== 'object') continue
      const mapName =
        typeof (map as { name?: unknown }).name === 'string' ? (map as { name: string }).name : 'Unknown map'
      const mapIdRaw = (map as { id?: unknown }).id
      const mapId = typeof mapIdRaw === 'number' ? mapIdRaw : Number.parseInt(mapIds[m], 10)
      const safeMapId = Number.isFinite(mapId) ? mapId : 0
      const pois = (map as { points_of_interest?: unknown }).points_of_interest

      const challenges = readList<{ id?: unknown; coord?: unknown }>((map as { skill_challenges?: unknown }).skill_challenges)
      for (let c = 0; c < challenges.length; c += 1) {
        const row = challenges[c]
        if (!row) continue
        const xy = coordOf(row.coord)
        if (!xy) continue
        const rawId = typeof row.id === 'string' ? row.id.trim() : ''
        const id = rawId || `coord-${safeMapId}-${Math.round(xy[0])}-${Math.round(xy[1])}`
        const nearby = nearestLandmarkName(xy, pois)
        add({
          id,
          kind: 'hero_point',
          x: xy[0],
          y: xy[1],
          mapId: safeMapId,
          mapName,
          regionName,
          expansion: expansionFromRegion(regionName, id),
          nearby,
          name: resourceName('hero_point', `${mapName} hero challenge`, nearby, mapName),
          trackable: true,
        })
      }

      const masteries = readList<{ id?: unknown; coord?: unknown; region?: unknown }>(
        (map as { mastery_points?: unknown }).mastery_points
      )
      for (let i = 0; i < masteries.length; i += 1) {
        const row = masteries[i]
        if (!row) continue
        const xy = coordOf(row.coord)
        if (!xy) continue
        const masteryId = Number(row.id)
        if (!Number.isFinite(masteryId)) continue
        const nearby = nearestLandmarkName(xy, pois)
        const regionLabel =
          typeof row.region === 'string' && row.region.trim() ? row.region.trim() : regionName
        add({
          id: `mastery-${masteryId}`,
          kind: 'mastery',
          x: xy[0],
          y: xy[1],
          mapId: safeMapId,
          mapName,
          regionName,
          expansion: expansionFromRegion(regionName, ''),
          nearby,
          name: resourceName('mastery', `Mastery insight (${regionLabel})`, nearby, mapName),
          trackable: true,
        })
      }

      const poiRows = readList<{ id?: unknown; name?: unknown; type?: unknown; coord?: unknown }>(pois)
      for (let i = 0; i < poiRows.length; i += 1) {
        const row = poiRows[i]
        if (!row) continue
        const type = typeof row.type === 'string' ? row.type.toLowerCase() : ''
        const kind: Gw2ResourceKind | null = type === 'vista' ? 'vista' : type === 'waypoint' ? 'waypoint' : null
        if (!kind) continue
        const xy = coordOf(row.coord)
        if (!xy) continue
        const poiId = Number(row.id)
        if (!Number.isFinite(poiId)) continue
        const label =
          typeof row.name === 'string' && row.name.trim()
            ? row.name.trim()
            : kind === 'vista'
              ? `${mapName} vista`
              : `${mapName} waypoint`
        add({
          id: `${kind}-${poiId}`,
          kind,
          x: xy[0],
          y: xy[1],
          mapId: safeMapId,
          mapName,
          regionName,
          expansion: expansionFromRegion(regionName, ''),
          nearby: null,
          name: label,
          trackable: false,
        })
      }

      const tasks = readList<{ id?: unknown; objective?: unknown; coord?: unknown }>((map as { tasks?: unknown }).tasks)
      for (let i = 0; i < tasks.length; i += 1) {
        const row = tasks[i]
        if (!row) continue
        const xy = coordOf(row.coord)
        if (!xy) continue
        const taskId = Number(row.id)
        if (!Number.isFinite(taskId)) continue
        const nearby = nearestLandmarkName(xy, pois)
        const objective =
          typeof row.objective === 'string' && row.objective.trim()
            ? row.objective.trim()
            : `${mapName} renown heart`
        add({
          id: `heart-${taskId}`,
          kind: 'heart',
          x: xy[0],
          y: xy[1],
          mapId: safeMapId,
          mapName,
          regionName,
          expansion: expansionFromRegion(regionName, ''),
          nearby,
          name: resourceName('heart', objective, nearby, mapName),
          trackable: false,
        })
      }
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.mapName.localeCompare(b.mapName) || a.name.localeCompare(b.name)
  )
}

export function collectSkillChallenges(floor: unknown): HeroPoint[] {
  return collectMapResources(floor).filter((point) => point.kind === 'hero_point')
}

export function resourceTitle(point: Pick<HeroPoint, 'name'>): string {
  return point.name
}
