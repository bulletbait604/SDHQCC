import { gw2Get, gw2GetSafe } from './client'
import { gw2GetMany } from './pool'
import type { Gw2AchievementGroup, Gw2AchievementPayload, Gw2AchievementRow } from './types'

type GroupJson = { id?: number; name?: string; categories?: number[] }
type CategoryJson = { id?: number; name?: string; achievements?: number[] }
type AchievementJson = {
  id?: number
  name?: string
  tiers?: Array<{ count?: number }>
}
type AccountAchievement = { id?: number; current?: number; max?: number; done?: boolean }

type Catalog = {
  groups: Gw2AchievementGroup[]
  items: Array<Omit<Gw2AchievementRow, 'done' | 'current' | 'max'> & { max: number }>
}

const CATALOG_TTL_MS = 12 * 60 * 60 * 1000
let catalogCache: { at: number; catalog: Catalog } | null = null

async function gw2GetAllObjects<T>(path: string): Promise<T[]> {
  try {
    const all = await gw2Get<unknown>(`${path}?ids=all`)
    if (Array.isArray(all) && all.length && typeof all[0] === 'object') return all as T[]
  } catch {
    /* some GW2 collections reject ids=all */
  }
  const idsRaw = await gw2Get<unknown>(path)
  const ids = Array.isArray(idsRaw) ? idsRaw.map((id) => Number(id)).filter(Number.isFinite) : []
  return gw2GetMany((chunk) => gw2Get<T[]>(`${path}?ids=${chunk.join(',')}`), ids)
}

async function loadCatalog(): Promise<Catalog> {
  const now = Date.now()
  if (catalogCache && now - catalogCache.at < CATALOG_TTL_MS) return catalogCache.catalog

  const groupsJson = await gw2GetAllObjects<GroupJson>('/achievements/groups')
  const categoriesJson = await gw2GetAllObjects<CategoryJson>('/achievements/categories')
  const groups = (Array.isArray(groupsJson) ? groupsJson : [])
    .map((row) => ({
      id: Number(row.id),
      name: typeof row.name === 'string' ? row.name : 'Group',
      categories: Array.isArray(row.categories) ? row.categories.map((id) => Number(id)).filter(Number.isFinite) : [],
    }))
    .filter((row) => Number.isFinite(row.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  const categoryById = new Map<number, { name: string; groupId: number; groupName: string; achievementIds: number[] }>()
  for (let g = 0; g < groups.length; g += 1) {
    const group = groups[g]
    for (let c = 0; c < group.categories.length; c += 1) {
      categoryById.set(group.categories[c], {
        name: '',
        groupId: group.id,
        groupName: group.name,
        achievementIds: [],
      })
    }
  }

  const categoryIds: number[] = []
  const catList = Array.isArray(categoriesJson) ? categoriesJson : []
  for (let i = 0; i < catList.length; i += 1) {
    const cat = catList[i]
    if (!cat) continue
    const id = Number(cat.id)
    if (!Number.isFinite(id)) continue
    const existing = categoryById.get(id)
    const achievementIds = Array.isArray(cat.achievements)
      ? cat.achievements.map((n) => Number(n)).filter(Number.isFinite)
      : []
    const catName = typeof cat.name === 'string' ? cat.name : 'Category'
    if (existing) {
      existing.name = catName
      existing.achievementIds = achievementIds
    } else {
      categoryById.set(id, {
        name: catName,
        groupId: 0,
        groupName: 'Other',
        achievementIds,
      })
    }
    categoryIds.push(id)
  }

  const achievementIds: number[] = []
  const seen = new Set<number>()
  for (let i = 0; i < categoryIds.length; i += 1) {
    const cat = categoryById.get(categoryIds[i])
    if (!cat) continue
    for (let a = 0; a < cat.achievementIds.length; a += 1) {
      const id = cat.achievementIds[a]
      if (seen.has(id)) continue
      seen.add(id)
      achievementIds.push(id)
    }
  }

  const details = await gw2GetMany<AchievementJson>(
    (ids) => gw2Get<AchievementJson[]>(`/achievements?ids=${ids.join(',')}`),
    achievementIds,
    200,
    4
  )

  const categoryOfAchievement = new Map<number, number>()
  for (let i = 0; i < categoryIds.length; i += 1) {
    const cat = categoryById.get(categoryIds[i])
    if (!cat) continue
    for (let a = 0; a < cat.achievementIds.length; a += 1) {
      if (!categoryOfAchievement.has(cat.achievementIds[a])) {
        categoryOfAchievement.set(cat.achievementIds[a], categoryIds[i])
      }
    }
  }

  const items: Catalog['items'] = []
  for (let i = 0; i < details.length; i += 1) {
    const row = details[i]
    const id = Number(row.id)
    if (!Number.isFinite(id)) continue
    const categoryId = categoryOfAchievement.get(id)
    if (categoryId == null) continue
    const cat = categoryById.get(categoryId)
    if (!cat) continue
    const tiers = Array.isArray(row.tiers) ? row.tiers : []
    const last = tiers.length ? Number(tiers[tiers.length - 1]?.count) : 0
    items.push({
      id,
      name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : `Achievement ${id}`,
      groupId: cat.groupId,
      groupName: cat.groupName,
      categoryId,
      categoryName: cat.name,
      max: Number.isFinite(last) && last > 0 ? last : 1,
    })
  }

  items.sort((a, b) => a.groupName.localeCompare(b.groupName) || a.name.localeCompare(b.name))
  const catalog: Catalog = {
    groups: groups.map(({ id, name }) => ({ id, name })),
    items,
  }
  catalogCache = { at: now, catalog }
  return catalog
}

export async function loadAchievementTracker(apiKey: string | null): Promise<Gw2AchievementPayload> {
  const catalog = await loadCatalog()
  const key = (apiKey || '').trim() || null
  const progress = new Map<number, AccountAchievement>()
  let progressAvailable = false
  let note: string | undefined

  if (key) {
    const raw = await gw2GetSafe<AccountAchievement[]>('/account/achievements', key)
    if (Array.isArray(raw)) {
      progressAvailable = true
      for (let i = 0; i < raw.length; i += 1) {
        const id = Number(raw[i]?.id)
        if (!Number.isFinite(id)) continue
        progress.set(id, raw[i])
      }
    } else {
      note = 'Could not read account achievements. Check that this ArenaNet API key has the progression scope.'
    }
  } else {
    note = 'Paste your ArenaNet API to mark which achievements this account has completed.'
  }

  let doneCount = 0
  const items: Gw2AchievementRow[] = catalog.items.map((row) => {
    const acct = progress.get(row.id)
    const done = Boolean(acct?.done)
    if (done) doneCount += 1
    return {
      ...row,
      done,
      current: typeof acct?.current === 'number' ? acct.current : done ? row.max : 0,
      max: typeof acct?.max === 'number' && acct.max > 0 ? acct.max : row.max,
    }
  })

  return {
    progressAvailable,
    doneCount,
    totalCount: items.length,
    groups: catalog.groups,
    items,
    note,
  }
}
