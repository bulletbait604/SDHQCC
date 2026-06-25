'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_PLATFORMS } from '@/lib/home/defaultPlatforms'
import type { ActivityLogEntry, Platform } from '@/lib/home/types'
import { postActivityLog } from '@/lib/home/activityLogUtils'
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
        const getRes = await fetch('/api/algorithms', { credentials: 'include' })
        if (!getRes.ok) throw new Error(`API error: ${getRes.status}`)
        const getData = await getRes.json()
        const lastFromApi = getData.lastUpdated as string | undefined

        const needsSundayRefresh = (): boolean => {
          const now = new Date()
          if (now.getDay() !== 0) return false
          if (!lastFromApi) return true
          const lu = new Date(lastFromApi)
          const daysSince = Math.floor((now.getTime() - lu.getTime()) / (1000 * 60 * 60 * 24))
          return daysSince >= 6
        }

        if (needsSundayRefresh()) {
          const postRes = await fetch('/api/algorithms', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
          if (!postRes.ok) throw new Error(`API error: ${postRes.status}`)
          const data = await postRes.json()
          if (data.data) {
            setLastUpdated(data.lastUpdated)
            setPlatforms((prev) =>
              prev.map((p) => ({ ...p, data: data.data[p.id] || null }))
            )
          }
        } else if (getData.data) {
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
          const details = platformName
            ? `Manual ${platformName} algorithm refresh${payload.provider ? ` via ${payload.provider}` : ''}`
            : `Manual algorithm refresh${payload.provider ? ` via ${payload.provider}` : ''}`
          const refreshEntry: ActivityLogEntry = {
            id: Date.now().toString(),
            username: user.username,
            timestamp: new Date().toISOString(),
            action: 'algorithm_refresh',
            details,
          }
          onActivityLog(refreshEntry)
          void postActivityLog({
            username: user.username,
            action: 'algorithm_refresh',
            details,
          })
          alert(
            platformName
              ? `${platformName} algorithm refreshed successfully!`
              : 'Algorithms refreshed successfully!'
          )
        }
      } catch (error) {
        console.error('Algorithm refresh error:', error)
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
