export type HeroPointFilter = 'all' | 'completed' | 'incomplete' | 'untracked'

export type Gw2ResourceKind = 'hero_point' | 'mastery' | 'vista' | 'waypoint' | 'heart'

export const GW2_RESOURCE_KINDS: Gw2ResourceKind[] = [
  'hero_point',
  'mastery',
  'vista',
  'waypoint',
  'heart',
]

export const GW2_RESOURCE_LABELS: Record<Gw2ResourceKind, string> = {
  hero_point: 'Hero points',
  mastery: 'Mastery insights',
  vista: 'Vistas',
  waypoint: 'Waypoints',
  heart: 'Renown hearts',
}

export type Gw2ContinentInfo = {
  id: number
  name: string
  floor: number
  dims: [number, number]
  minZoom: number
  maxZoom: number
}

export type HeroPoint = {
  id: string
  kind: Gw2ResourceKind
  x: number
  y: number
  mapId: number
  mapName: string
  regionName: string
  expansion: string
  name: string
  nearby: string | null
  trackable: boolean
}

export type Gw2LinkedKeyStatus = {
  accountName: string | null
  tokenName: string | null
  lastFour: string
  permissions: string[]
  updatedAt: string
}

export type Gw2AchievementGroup = {
  id: number
  name: string
}

export type Gw2AchievementRow = {
  id: number
  name: string
  groupId: number
  groupName: string
  categoryId: number
  categoryName: string
  done: boolean
  current: number
  max: number
}

export type Gw2AchievementPayload = {
  progressAvailable: boolean
  doneCount: number
  totalCount: number
  groups: Gw2AchievementGroup[]
  items: Gw2AchievementRow[]
  note?: string
}

export type HeroPointTrackerPayload = {
  continent: Gw2ContinentInfo
  points: HeroPoint[]
  completedIds: string[]
  completedCount: number
  totalCount: number
  countsByKind: Record<Gw2ResourceKind, { total: number; completed: number; trackable: number }>
  accountName: string | null
  characterCount: number
  keyConfigured: boolean
  keySource: 'user' | 'env' | 'none'
  linkedKey: Gw2LinkedKeyStatus | null
  progressAvailable: boolean
  note?: string
}
