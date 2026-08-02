'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_PLATFORMS } from '@/lib/home/defaultPlatforms'
import type { ActivityLogEntry, Platform } from '@/lib/home/types'
import type { KickUser } from '@/lib/home/types'

export interface UseHomeAlgorithmsOptions {
  user: KickUser | null
  isAdmin: boolean
  onActivityLog: (entry: ActivityLogEntry) => void
  /** Called once on mount after session load (algorithms + tag index warmup). */
  runOnMount?: boolean
}

export function useHomeAlgorithms({ user, isAdmin, onActivityLog, runOnMount = true }: UseHomeAlgorithmsOptions) {
  const [platforms, setPlatforms] = useState<Platform[]>(DEFAULT_PLATFORMS)
  const [lastUpdated, setLastUpdated] = useState('Loading...')
  const [isLoadingAlgorithms, setIsLoadingAlgorithms] = useState(false)
  const [algorithmError, setAlgorithmError] = useState<string | null>(null)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  const loadAlgorithmsAndTags = useCallback(() => {
    setIsLoadingAlgorithms(true)
    setAlgorithmError(null)

    void (async () => {
      try {
        // Landing / Resource Hub always read the shared Mongo snapshot.
        // Fresh research runs automatically via Vercel Cron on the 1st of each month
        // (GET /api/algorithms/update) — clients never trigger research themselves.
        const getRes = await fetch('/api/algorithms', { credentials: 'include' })
        if (!getRes.ok) throw new Error(`API error: ${getRes.status}`)
        const getData = await getRes.json()
        if (getData.data) {
          setLastUpdated(getData.lastUpdated)
          setPlatforms((prev) =>
            prev.map((p) => ({ ...p, data: getData.data[p.id] || null }))
          )
        }
      } catch (error) {
        console.error('Error loading algorithm data:', error)
        setAlgorithmError('Failed to load algorithm data.')
      } finally {
        setIsLoadingAlgorithms(false)
      }
    })()

    void fetch('/api/tags', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        return res.json()
      })
      .catch((error) => console.error('Error fetching tag database status:', error))
  }, [])

  useEffect(() => {
    if (runOnMount) loadAlgorithmsAndTags()
  }, [runOnMount, loadAlgorithmsAndTags])

  const handleRefreshAlgorithms = useCallback(
    async (platformId?: string) => {
      if (!user || !isAdmin) {
        alert('Only admins can refresh algorithm research.')
        return
      }
      setIsLoadingAlgorithms(true)
      try {
        const res = await fetch('/api/algorithms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(platformId ? { platformId } : {}),
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg =
            typeof payload.userMessage === 'string'
              ? payload.userMessage
              : typeof payload.error === 'string'
                ? payload.error
                : `Request failed (${res.status})`
          throw new Error(msg)
        }
        if (payload.data) {
          setLastUpdated(payload.lastUpdated)
          setPlatforms((prev) =>
            prev.map((p) => ({
              ...p,
              data: payload.data[p.id] ?? p.data,
            }))
          )
          const platformName = platformId
            ? platforms.find((p) => p.id === platformId)?.name
            : null
          // Server writes the canonical activity-log entry (success/partial + details).
          // Mirror it locally so the Activity Log UI updates immediately.
          const details =
            typeof payload.incomplete === 'boolean' && payload.incomplete
              ? `[SUCCESS] staff — Partial ${platformName || 'all platforms'} update via ${payload.provider || 'AI'}. Some platforms kept previous data.`
              : `[SUCCESS] staff — ${platformName || 'All platforms'} algorithm refresh via ${payload.provider || 'AI'} (${payload.model || 'gemini-2.5-flash-lite'}).`
          const refreshEntry: ActivityLogEntry = {
            id: Date.now().toString(),
            username: user.username,
            timestamp: new Date().toISOString(),
            action: 'algorithm_refresh',
            details,
            estimatedCostNote:
              typeof payload.estimatedCostNote === 'string'
                ? payload.estimatedCostNote
                : undefined,
          }
          onActivityLog(refreshEntry)
          alert(
            platformName
              ? `${platformName} algorithm refreshed successfully!`
              : 'Algorithms refreshed successfully!'
          )
        }
      } catch (error) {
        console.error('Algorithm refresh error:', error)
        // Server already wrote algorithm_refresh_failed to the activity log.
        alert(error instanceof Error ? error.message : 'Failed to refresh algorithms.')
      } finally {
        setIsLoadingAlgorithms(false)
      }
    },
    [user, isAdmin, onActivityLog, platforms]
  )

  return {
    platforms,
    setPlatforms,
    lastUpdated,
    isLoadingAlgorithms,
    algorithmError,
    expandedCard,
    setExpandedCard,
    loadAlgorithmsAndTags,
    handleRefreshAlgorithms,
  }
}
