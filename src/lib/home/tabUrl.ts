import type { CreateSubTab } from '@/app/components/CreateTabHeader'
import type { RdSubTab } from '@/app/components/RdTabHeader'
import type { DestinyTopNestTab } from '@/lib/destiny/types'

export interface HomeTabState {
  tab: string
  create?: CreateSubTab
  rnd?: RdSubTab
  destiny?: DestinyTopNestTab
}

const MAIN_TABS = new Set(['educate', 'create', 'analyze', 'kick-clips', 'settings', 'rnd'])
const CREATE_SUBS = new Set<CreateSubTab>(['tags', 'thumbnail', 'post4me', 'background'])
const RND_SUBS = new Set<RdSubTab>(['clip-editor', 'tradebot', 'destiny-top-nest'])
const DESTINY_TABS = new Set<DestinyTopNestTab>([
  'overview',
  'leaderboards',
  'fireteam',
  'profile',
  'loadouts',
  'builds',
  'clans',
  'season',
  'admin',
])

/** Legacy ?tab= names from older links and OAuth redirects. */
const LEGACY_TAB_MAP: Record<string, HomeTabState> = {
  'resource-hub': { tab: 'educate' },
  'tag-generator-free': { tab: 'create', create: 'tags' },
  'thumbnail-generator': { tab: 'create', create: 'thumbnail' },
  'background-remover': { tab: 'create', create: 'background' },
  post4me: { tab: 'create', create: 'post4me' },
  'clip-analyzer': { tab: 'analyze' },
  'clip-editor': { tab: 'rnd', rnd: 'clip-editor' },
  'destiny-top-nest': { tab: 'rnd', rnd: 'destiny-top-nest' },
  'new-tool': { tab: 'educate' },
}

export function isDestinyTopNestTab(value: string): value is DestinyTopNestTab {
  return DESTINY_TABS.has(value as DestinyTopNestTab)
}

export function parseHomeTabFromSearch(search: string): HomeTabState {
  const params = new URLSearchParams(search)
  const tabParam = params.get('tab')

  if (tabParam && LEGACY_TAB_MAP[tabParam]) {
    const legacy = LEGACY_TAB_MAP[tabParam]
    const destinyParam = params.get('destiny')
    return {
      ...legacy,
      destiny:
        legacy.rnd === 'destiny-top-nest' && destinyParam && isDestinyTopNestTab(destinyParam)
          ? destinyParam
          : legacy.rnd === 'destiny-top-nest' && params.get('bungie')
            ? 'profile'
            : legacy.destiny,
    }
  }

  const tab = tabParam && MAIN_TABS.has(tabParam) ? tabParam : 'educate'
  const createParam = params.get('create')
  const rndParam = params.get('rnd')
  const destinyParam = params.get('destiny')

  const create = createParam && CREATE_SUBS.has(createParam as CreateSubTab)
    ? (createParam as CreateSubTab)
    : undefined
  const rnd = rndParam && RND_SUBS.has(rndParam as RdSubTab) ? (rndParam as RdSubTab) : undefined
  let destiny =
    destinyParam && isDestinyTopNestTab(destinyParam) ? destinyParam : undefined

  if (!destiny && rnd === 'destiny-top-nest' && params.get('bungie')) {
    destiny = 'profile'
  }

  return { tab, create, rnd, destiny }
}

/** Update tab-related query params while preserving unrelated ones (e.g. verified). */
export function syncHomeTabToUrl(state: HomeTabState) {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)
  params.set('tab', state.tab)

  if (state.tab === 'create' && state.create) params.set('create', state.create)
  else params.delete('create')

  if (state.tab === 'rnd' && state.rnd) params.set('rnd', state.rnd)
  else params.delete('rnd')

  if (state.rnd === 'destiny-top-nest' && state.destiny && state.destiny !== 'overview') {
    params.set('destiny', state.destiny)
  } else {
    params.delete('destiny')
  }

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
    return parsed?.tab ? parsed : null
  } catch {
    return null
  }
}

export function writeStoredHomeTabState(state: HomeTabState) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(HOME_TAB_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage full or disabled */
  }
}

/** Prefer URL params, then sessionStorage backup, then defaults. */
export function resolveHomeTabState(search: string): HomeTabState {
  const params = new URLSearchParams(search)
  const hasUrlState =
    params.has('tab') || params.has('create') || params.has('rnd') || params.has('destiny')

  if (hasUrlState) return parseHomeTabFromSearch(search)

  const stored = readStoredHomeTabState()
  if (stored) return stored

  return parseHomeTabFromSearch(search)
}

/** Persist tab state to URL and sessionStorage (survives refresh even before URL sync runs). */
export function persistHomeTabState(state: HomeTabState) {
  syncHomeTabToUrl(state)
  writeStoredHomeTabState(state)
}

export function syncDestinySubTabToUrl(destinyTab: DestinyTopNestTab) {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)
  if (destinyTab === 'overview') params.delete('destiny')
  else params.set('destiny', destinyTab)

  const qs = params.toString()
  const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
  window.history.replaceState(null, '', next)
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

export function defaultBungieReturnPath(): string {
  return '/?tab=rnd&rnd=destiny-top-nest&destiny=profile'
}
