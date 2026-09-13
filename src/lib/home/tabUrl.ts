import type { CreateSubTab } from '@/app/components/CreateTabHeader'
import type { RdSubTab } from '@/app/components/RdTabHeader'
import type { UserAppSubTab } from '@/app/components/UserAppsTabHeader'

export interface HomeTabState {
  tab: string
  create?: CreateSubTab
  rnd?: RdSubTab
  apps?: UserAppSubTab
}

export const DEFAULT_HOME_TAB = 'educate'
export const DEFAULT_CREATE_SUB: CreateSubTab = 'thumbnail'
export const DEFAULT_RND_SUB: RdSubTab = 'viral-clip-gen'
export const DEFAULT_USER_APP: UserAppSubTab = 'vi-guys-gw-map'

const TAB_QUERY_KEYS = ['tab', 'create', 'rnd', 'apps'] as const

const MAIN_TABS = new Set(['educate', 'create', 'analyze', 'kick-clips', 'settings', 'rnd', 'user-apps'])
const CREATE_SUBS = new Set<CreateSubTab>(['tags', 'thumbnail', 'post4me', 'background'])
const RND_SUBS = new Set<RdSubTab>([
  'narrate-me',
  'viral-clip-gen',
  'trending-vids',
  'going-live',
  'tradebot',
  'viruses-port-scanner',
])
const USER_APPS = new Set<UserAppSubTab>(['vi-guys-gw-map', 'kick-clips'])

/** Legacy ?tab= names from older links. */
const LEGACY_TAB_MAP: Record<string, HomeTabState> = {
  'resource-hub': { tab: DEFAULT_HOME_TAB },
  'tag-generator-free': { tab: 'create', create: 'tags' },
  'thumbnail-generator': { tab: 'create', create: 'thumbnail' },
  'background-remover': { tab: 'create', create: 'background' },
  post4me: { tab: 'create', create: 'post4me' },
  'clip-analyzer': { tab: 'analyze' },
  'clip-editor': { tab: 'rnd', rnd: 'viral-clip-gen' },
  'robot-talk': { tab: 'rnd', rnd: 'viral-clip-gen' },
  'thumbnail-2': { tab: 'rnd', rnd: 'viral-clip-gen' },
  'panels-banners': { tab: 'rnd', rnd: 'going-live' },
  'new-tool': { tab: DEFAULT_HOME_TAB },
  'user-apps': { tab: 'kick-clips', apps: DEFAULT_USER_APP },
}

function coerceRnd(rnd: RdSubTab | undefined): RdSubTab | undefined {
  if (!rnd) return rnd
  return RND_SUBS.has(rnd) ? rnd : DEFAULT_RND_SUB
}

function coerceUserApp(apps: UserAppSubTab | undefined): UserAppSubTab | undefined {
  if (!apps) return apps
  return USER_APPS.has(apps) ? apps : DEFAULT_USER_APP
}

export function normalizeHomeTabState(state: HomeTabState): HomeTabState {
  const tab = state.tab === 'user-apps' ? 'kick-clips' : state.tab || DEFAULT_HOME_TAB
  const rndMovedToApps = state.rnd === ('vi-guys-gw-map' as string)
  return {
    tab: rndMovedToApps && tab === 'rnd' ? 'kick-clips' : tab,
    create: tab === 'create' ? (state.create ?? DEFAULT_CREATE_SUB) : state.create,
    rnd:
      tab === 'rnd' && !rndMovedToApps
        ? (coerceRnd(state.rnd) ?? DEFAULT_RND_SUB)
        : coerceRnd(state.rnd === ('vi-guys-gw-map' as string) ? undefined : state.rnd),
    apps:
      tab === 'kick-clips' || rndMovedToApps
        ? (coerceUserApp(rndMovedToApps ? 'vi-guys-gw-map' : state.apps) ?? DEFAULT_USER_APP)
        : coerceUserApp(state.apps),
  }
}

export function parseHomeTabFromSearch(search: string): HomeTabState {
  const params = new URLSearchParams(search)
  const tabParam = params.get('tab')

  if (tabParam && LEGACY_TAB_MAP[tabParam]) {
    return normalizeHomeTabState(LEGACY_TAB_MAP[tabParam])
  }

  const tab = tabParam && MAIN_TABS.has(tabParam) ? tabParam : DEFAULT_HOME_TAB
  const createParam = params.get('create')
  const rndParam = params.get('rnd')
  const appsParam = params.get('apps')

  const create =
    createParam && CREATE_SUBS.has(createParam as CreateSubTab)
      ? (createParam as CreateSubTab)
      : undefined
  const rnd = rndParam && RND_SUBS.has(rndParam as RdSubTab) ? (rndParam as RdSubTab) : undefined
  const apps =
    (rndParam === 'vi-guys-gw-map' ? 'vi-guys-gw-map' : undefined) ||
    (appsParam && USER_APPS.has(appsParam as UserAppSubTab) ? (appsParam as UserAppSubTab) : undefined)

  return normalizeHomeTabState({ tab, create, rnd, apps })
}

export function buildTabQuery(state: HomeTabState): URLSearchParams {
  const normalized = normalizeHomeTabState(state)
  const q = new URLSearchParams()

  const isHomeDefault =
    normalized.tab === DEFAULT_HOME_TAB && !normalized.create && !normalized.rnd && !normalized.apps

  if (isHomeDefault) return q

  q.set('tab', normalized.tab)

  if (normalized.tab === 'create') {
    const sub = normalized.create ?? DEFAULT_CREATE_SUB
    if (sub !== DEFAULT_CREATE_SUB) q.set('create', sub)
  }

  if (normalized.tab === 'rnd') {
    const sub = normalized.rnd ?? DEFAULT_RND_SUB
    if (sub !== DEFAULT_RND_SUB) q.set('rnd', sub)
  }

  if (normalized.tab === 'kick-clips') {
    const sub = normalized.apps ?? DEFAULT_USER_APP
    if (sub !== DEFAULT_USER_APP) q.set('apps', sub)
  }

  return q
}

export function syncHomeTabToUrl(state: HomeTabState) {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)
  for (const key of TAB_QUERY_KEYS) params.delete(key)

  const tabQuery = buildTabQuery(state)
  tabQuery.forEach((value, key) => {
    params.set(key, value)
  })

  const qs = params.toString()
  const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
  window.history.replaceState(null, '', next)
}

export const HOME_TAB_STORAGE_KEY = 'sdhq_home_tabs'

export function readStoredHomeTabState(): HomeTabState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(HOME_TAB_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as HomeTabState
    return parsed?.tab ? normalizeHomeTabState(parsed) : null
  } catch {
    return null
  }
}

export function writeStoredHomeTabState(state: HomeTabState) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(HOME_TAB_STORAGE_KEY, JSON.stringify(normalizeHomeTabState(state)))
  } catch {
    /* storage full or disabled */
  }
}

export function resolveHomeTabState(search: string): HomeTabState {
  const params = new URLSearchParams(search)
  const hasUrlState = params.has('tab') || params.has('create') || params.has('rnd') || params.has('apps')

  if (hasUrlState) return parseHomeTabFromSearch(search)

  const stored = readStoredHomeTabState()
  if (stored) return stored

  return parseHomeTabFromSearch(search)
}

export function persistHomeTabState(state: HomeTabState) {
  syncHomeTabToUrl(state)
  writeStoredHomeTabState(state)
}

export function clearHomeTabState() {
  stripUrlParams([...TAB_QUERY_KEYS])
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(HOME_TAB_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function stripUrlParams(keys: string[]) {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)
  let changed = false
  for (const key of keys) {
    if (params.has(key)) {
      params.delete(key)
      changed = true
    }
  }
  if (!changed) return

  const qs = params.toString()
  const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
  window.history.replaceState(null, '', next)
}
