'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Key, Loader2, MapPinned, RefreshCw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseJsonResponse } from '@/lib/http/parseJsonResponse'
import { filterAchievements } from '@/lib/gw2/achievementFilter'
import { resourceTitle } from '@/lib/gw2/mapResources'
import { completedSet, filterMapResources, uniqueExpansions } from '@/lib/gw2/progress'
import {
  GW2_RESOURCE_KINDS,
  GW2_RESOURCE_LABELS,
  type Gw2AchievementPayload,
  type Gw2ResourceKind,
  type HeroPoint,
  type HeroPointFilter,
  type HeroPointTrackerPayload,
} from '@/lib/gw2/types'

const HeroPointMap = dynamic(() => import('@/app/components/gw2/HeroPointMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[min(70vh,720px)] min-h-[420px] w-full rounded-2xl border border-sdhq-green-500/20 bg-black/40 flex items-center justify-center text-sm">
      Loading Tyria…
    </div>
  ),
})

export interface ViGuysGwMapTabProps {
  darkMode: boolean
  subtitleClasses: string
  description: string
  kickUsername: string
}

const ALL_KINDS = new Set<Gw2ResourceKind>(GW2_RESOURCE_KINDS)

export default function ViGuysGwMapTab({
  darkMode,
  subtitleClasses,
  description,
  kickUsername,
}: ViGuysGwMapTabProps) {
  const [isWorking, setIsWorking] = useState(false)
  const [achievementsWorking, setAchievementsWorking] = useState(false)
  const [keyBusy, setKeyBusy] = useState(false)
  const [error, setError] = useState('')
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [payload, setPayload] = useState<HeroPointTrackerPayload | null>(null)
  const [achievements, setAchievements] = useState<Gw2AchievementPayload | null>(null)
  const [filter, setFilter] = useState<HeroPointFilter>('all')
  const [kinds, setKinds] = useState<Set<Gw2ResourceKind>>(ALL_KINDS)
  const [expansion, setExpansion] = useState('all')
  const [mapQuery, setMapQuery] = useState('')
  const [achievementQuery, setAchievementQuery] = useState('')
  const [achievementGroup, setAchievementGroup] = useState<number | 'all'>('all')
  const [achievementStatus, setAchievementStatus] = useState<'all' | 'completed' | 'incomplete'>('all')
  const [selected, setSelected] = useState<{ point: HeroPoint; completed: boolean } | null>(null)

  const shell = darkMode
    ? 'bg-black/70 border-sdhq-green-500/30 text-sdhq-green-100'
    : 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
  const card = darkMode
    ? 'bg-sdhq-dark-900/80 border-sdhq-green-500/25'
    : 'bg-white/90 border-emerald-200'
  const textMain = darkMode ? 'text-sdhq-green-100' : 'text-emerald-950'
  const accent = darkMode ? 'text-sdhq-green-400' : 'text-emerald-700'
  const chipIdle = darkMode
    ? 'border-sdhq-green-800 bg-black text-sdhq-green-300 hover:border-sdhq-green-500'
    : 'border-emerald-300 bg-white text-emerald-800 hover:border-emerald-500'
  const chipActive = darkMode
    ? 'border-sdhq-green-400 bg-sdhq-green-500/15 text-sdhq-green-300'
    : 'border-emerald-600 bg-emerald-600/10 text-emerald-800'
  const field = darkMode
    ? 'border-sdhq-green-800 bg-black/60 text-sdhq-green-100 placeholder:text-sdhq-green-700'
    : 'border-emerald-300 bg-white text-emerald-950 placeholder:text-emerald-400'

  const loadAchievements = useCallback(async () => {
    setAchievementsWorking(true)
    try {
      const res = await fetch('/api/vi-guys-gw-map/achievements', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })
      const data = await parseJsonResponse<Gw2AchievementPayload & { userMessage?: string; error?: string }>(res)
      if (!res.ok) throw new Error(data.userMessage || data.error || 'Failed to load achievements')
      setAchievements(data)
    } catch (err) {
      setAchievements(null)
      setError(err instanceof Error ? err.message : 'Failed to load achievements')
    } finally {
      setAchievementsWorking(false)
    }
  }, [])

  const load = useCallback(async () => {
    setIsWorking(true)
    setError('')
    try {
      const res = await fetch('/api/vi-guys-gw-map', { method: 'GET', credentials: 'include', cache: 'no-store' })
      const data = await parseJsonResponse<HeroPointTrackerPayload & { userMessage?: string; error?: string }>(
        res
      )
      if (!res.ok) throw new Error(data.userMessage || data.error || 'Failed to load GW2 map')
      if (!Array.isArray(data.points)) throw new Error('GW2 map returned no locations.')
      setPayload(data)
      setSelected(null)
      void loadAchievements()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load GW2 map')
    } finally {
      setIsWorking(false)
    }
  }, [loadAchievements])

  useEffect(() => {
    void load()
  }, [load])

  const saveKey = useCallback(async () => {
    setKeyBusy(true)
    setError('')
    try {
      const res = await fetch('/api/vi-guys-gw-map/key', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyDraft }),
      })
      const data = await parseJsonResponse<{ userMessage?: string; error?: string }>(res)
      if (!res.ok) throw new Error(data.userMessage || data.error || 'Could not save ArenaNet API key')
      setApiKeyDraft('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save ArenaNet API key')
    } finally {
      setKeyBusy(false)
    }
  }, [apiKeyDraft, load])

  const unlinkKey = useCallback(async () => {
    setKeyBusy(true)
    setError('')
    try {
      const res = await fetch('/api/vi-guys-gw-map/key', { method: 'DELETE', credentials: 'include' })
      const data = await parseJsonResponse<{ userMessage?: string; error?: string }>(res)
      if (!res.ok) throw new Error(data.userMessage || data.error || 'Could not remove ArenaNet API key')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove ArenaNet API key')
    } finally {
      setKeyBusy(false)
    }
  }, [load])

  const toggleKind = useCallback((kind: Gw2ResourceKind) => {
    setKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      if (next.size === 0) next.add(kind)
      return next
    })
  }, [])

  const done = useMemo(() => completedSet(payload?.completedIds || []), [payload])
  const expansions = useMemo(() => uniqueExpansions(payload?.points || []), [payload])
  const visible = useMemo(() => {
    if (!payload) return []
    return filterMapResources(payload.points, done, { filter, kinds, expansion, query: mapQuery })
  }, [payload, done, filter, kinds, expansion, mapQuery])

  const visibleAchievements = useMemo(() => {
    if (!achievements) return []
    return filterAchievements(achievements.items, {
      query: achievementQuery,
      groupId: achievementGroup,
      status: achievementStatus,
    })
  }, [achievements, achievementQuery, achievementGroup, achievementStatus])

  const linked = payload?.linkedKey || null

  return (
    <div className={`rounded-2xl border p-4 sm:p-6 space-y-4 ${shell}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
              darkMode
                ? 'border-sdhq-green-500/40 bg-sdhq-green-500/10 text-sdhq-green-400'
                : 'border-emerald-400 bg-emerald-100 text-emerald-700'
            }`}
          >
            <MapPinned className="w-6 h-6" />
          </span>
          <div>
            <p className={`text-[11px] font-mono uppercase tracking-[0.22em] ${accent}`}>
              R&D · Guild Wars 2
            </p>
            <h4 className={`text-xl font-bold ${textMain}`}>Vi-Guys GW Map</h4>
            <p className={`text-sm mt-1 max-w-3xl ${subtitleClasses}`}>{description}</p>
            <p className={`text-xs mt-1 ${subtitleClasses}`}>Signed in as Kick user {kickUsername}</p>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => void load()}
          disabled={isWorking || keyBusy}
          className="bg-sdhq-green-500 hover:bg-sdhq-green-400 text-black shadow-neon-green"
        >
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading…
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </>
          )}
        </Button>
      </div>

      <div className={`rounded-xl border px-4 py-3 space-y-3 ${card}`}>
        <h5 className={`text-base font-semibold ${textMain}`}>
          Paste your ArenaNet API here to track your progress.
        </h5>
        <p className={`text-xs ${subtitleClasses}`}>
          Create a key at{' '}
          <a
            href="https://account.arena.net/applications"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-sdhq-green-500/60 underline-offset-2 hover:text-sdhq-green-400"
          >
            account.arena.net/applications
          </a>{' '}
          with <span className="font-semibold">account</span>, <span className="font-semibold">characters</span>, and{' '}
          <span className="font-semibold">progression</span>. It is encrypted for this Kick login and cannot be read
          by other users.
        </p>
        {linked && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <p className={`text-sm ${textMain}`}>
              Tracking {linked.accountName || 'this GW2 account'}
              {linked.tokenName ? ` · ${linked.tokenName}` : ''} · ****{linked.lastFour}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void unlinkKey()}
              disabled={keyBusy}
              className="sm:ml-auto border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
            >
              {keyBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
              Remove key
            </Button>
          </div>
        )}
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            void saveKey()
          }}
        >
          <label htmlFor="arenanet-api" className={`block text-sm font-semibold ${textMain}`}>
            ArenaNet API
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="arenanet-api"
              type="password"
              name="arenanet-api"
              autoComplete="off"
              spellCheck={false}
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              placeholder="Paste ArenaNet API key"
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-mono ${field}`}
            />
            <Button
              type="submit"
              disabled={keyBusy || apiKeyDraft.trim().length < 20}
              className="bg-sdhq-green-500 hover:bg-sdhq-green-400 text-black"
            >
              {keyBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
              {linked ? 'Update key' : 'Save key'}
            </Button>
          </div>
        </form>
      </div>

      {error && (
        <p className="text-sm text-rose-400" role="alert">
          {error}
        </p>
      )}

      {payload?.note && (
        <p
          className={`text-xs rounded-lg border px-3 py-2 ${
            darkMode ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-800'
          }`}
        >
          {payload.note}
        </p>
      )}

      {payload && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {GW2_RESOURCE_KINDS.map((kind) => {
            const row = payload.countsByKind?.[kind] || { total: 0, completed: 0, trackable: 0 }
            return (
              <div key={kind} className={`rounded-xl border px-3 py-3 ${card}`}>
                <div className={`text-[11px] uppercase tracking-wide font-semibold ${accent}`}>
                  {GW2_RESOURCE_LABELS[kind]}
                </div>
                <p className={`text-xl font-mono font-bold mt-1 ${textMain}`}>
                  {row.trackable ? `${row.completed}/${row.trackable}` : row.total}
                </p>
                <p className={`text-xs ${subtitleClasses}`}>{row.total} on map</p>
              </div>
            )
          })}
        </div>
      )}

      <div className={`rounded-xl border px-4 py-3 space-y-3 ${card}`}>
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${accent}`} />
          <input
            type="search"
            value={mapQuery}
            onChange={(e) => setMapQuery(e.target.value)}
            placeholder="Search map names, regions, expansions…"
            className={`w-full rounded-lg border pl-9 pr-3 py-2 text-sm ${field}`}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {GW2_RESOURCE_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => toggleKind(kind)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                kinds.has(kind) ? chipActive : chipIdle
              }`}
            >
              <span className={`gw2-hp-marker gw2-kind-${kind} inline-block mr-1.5 align-middle`} />
              {GW2_RESOURCE_LABELS[kind]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ['all', 'All'],
            ['completed', 'Completed'],
            ['incomplete', 'Not Completed'],
            ['untracked', 'Locations only'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                filter === id ? chipActive : chipIdle
              }`}
            >
              {label}
            </button>
          ))}
          <select
            value={expansion}
            onChange={(e) => setExpansion(e.target.value)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${field}`}
          >
            <option value="all">All expansions</option>
            {expansions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <span className={`text-xs ml-auto self-center ${subtitleClasses}`}>{visible.length} shown</span>
        </div>
      </div>

      {payload ? (
        <HeroPointMap
          continent={payload.continent}
          points={visible}
          completedIds={payload.completedIds}
          darkMode={darkMode}
          onSelect={(point, completed) => setSelected({ point, completed })}
        />
      ) : (
        <div className={`h-[min(70vh,720px)] min-h-[420px] rounded-2xl border flex items-center justify-center ${card}`}>
          {isWorking ? (
            <span className={`inline-flex items-center gap-2 text-sm ${subtitleClasses}`}>
              <Loader2 className="w-4 h-4 animate-spin" />
              Fetching Tyria map resources…
            </span>
          ) : (
            <span className={`text-sm ${subtitleClasses}`}>Map will appear after a successful load.</span>
          )}
        </div>
      )}

      {selected && (
        <div className={`rounded-xl border px-4 py-3 ${card}`}>
          <p className={`text-[11px] uppercase tracking-wide font-semibold ${accent}`}>
            {GW2_RESOURCE_LABELS[selected.point.kind]}
          </p>
          <p className={`text-lg font-semibold mt-1 ${textMain}`}>{resourceTitle(selected.point)}</p>
          <p className={`text-sm mt-1 ${subtitleClasses}`}>
            {selected.point.regionName} · {selected.point.mapName} · {selected.point.expansion}
          </p>
          <p className={`text-sm mt-1 ${selected.completed ? 'text-sdhq-green-400' : 'text-amber-400'}`}>
            {selected.point.trackable
              ? selected.completed
                ? 'Completed'
                : 'Not Completed'
              : 'Location only — ArenaNet does not report completion for this type'}
          </p>
          <p className={`text-xs font-mono mt-1 ${subtitleClasses}`}>
            {selected.point.id} · {Math.round(selected.point.x)}, {Math.round(selected.point.y)}
          </p>
        </div>
      )}

      <div className={`rounded-xl border px-4 py-3 space-y-3 ${card}`}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h5 className={`text-base font-semibold ${textMain}`}>Achievements</h5>
            <p className={`text-xs mt-1 ${subtitleClasses}`}>
              {achievements
                ? `${achievements.doneCount}/${achievements.totalCount} completed${
                    achievements.progressAvailable ? '' : ' · paste an ArenaNet API to mark yours'
                  }`
                : achievementsWorking
                  ? 'Loading achievement catalog…'
                  : 'Achievement list will appear after the map loads.'}
            </p>
          </div>
        </div>
        {achievements?.note && (
          <p className={`text-xs ${subtitleClasses}`}>{achievements.note}</p>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="relative sm:col-span-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${accent}`} />
            <input
              type="search"
              value={achievementQuery}
              onChange={(e) => setAchievementQuery(e.target.value)}
              placeholder="Search achievements…"
              className={`w-full rounded-lg border pl-9 pr-3 py-2 text-sm ${field}`}
            />
          </div>
          <select
            value={achievementGroup === 'all' ? 'all' : String(achievementGroup)}
            onChange={(e) => setAchievementGroup(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className={`rounded-lg border px-3 py-2 text-sm ${field}`}
          >
            <option value="all">All groups</option>
            {(achievements?.groups || []).map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <select
            value={achievementStatus}
            onChange={(e) => setAchievementStatus(e.target.value as 'all' | 'completed' | 'incomplete')}
            className={`rounded-lg border px-3 py-2 text-sm ${field}`}
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="incomplete">Not completed</option>
          </select>
        </div>
        <div className={`max-h-[420px] overflow-auto rounded-lg border ${darkMode ? 'border-sdhq-green-800' : 'border-emerald-200'}`}>
          {achievementsWorking && !achievements ? (
            <p className={`px-3 py-6 text-sm text-center ${subtitleClasses}`}>
              <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
              Loading achievements…
            </p>
          ) : visibleAchievements.length === 0 ? (
            <p className={`px-3 py-6 text-sm text-center ${subtitleClasses}`}>No achievements match these filters.</p>
          ) : (
            <ul className="divide-y divide-sdhq-green-800/40">
              {visibleAchievements.slice(0, 200).map((row) => (
                <li key={row.id} className="px-3 py-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${textMain}`}>{row.name}</p>
                    <p className={`text-xs ${subtitleClasses}`}>
                      {row.groupName} · {row.categoryName}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-semibold ${row.done ? 'text-sdhq-green-400' : 'text-amber-400'}`}>
                      {row.done ? 'Completed' : 'Not completed'}
                    </p>
                    <p className={`text-[11px] font-mono ${subtitleClasses}`}>
                      {row.current}/{row.max}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {visibleAchievements.length > 200 && (
            <p className={`px-3 py-2 text-xs ${subtitleClasses}`}>
              Showing 200 of {visibleAchievements.length}. Narrow the search or group filter to see the rest.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
