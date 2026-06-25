'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ActivityLogEntry, KickUser } from '@/lib/home/types'
import { normalizeActivityLogEntry, postActivityLog } from '@/lib/home/activityLogUtils'

export interface UseHomeActivityLogOptions {
  user: KickUser | null
  staffCanViewActivity: boolean
}

export function useHomeActivityLog({ user, staffCanViewActivity }: UseHomeActivityLogOptions) {
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])

  const appendActivityLog = useCallback((entry: ActivityLogEntry) => {
    setActivityLog((prev) => [entry, ...prev].slice(0, 100))
  }, [])

  const refreshActivityLog = useCallback(() => {
    if (!user || !staffCanViewActivity) return
    void fetch('/api/activity-log', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.logs && Array.isArray(data.logs)) {
          setActivityLog(
            (data.logs as Record<string, unknown>[])
              .map(normalizeActivityLogEntry)
              .filter((e): e is ActivityLogEntry => e !== null)
          )
        }
      })
      .catch((error) => console.error('Error refreshing activity logs:', error))
  }, [user, staffCanViewActivity])

  useEffect(() => {
    refreshActivityLog()
  }, [refreshActivityLog])

  useEffect(() => {
    if (!user) return
    const entry: ActivityLogEntry = {
      id: Date.now().toString(),
      username: user.username,
      timestamp: new Date().toISOString(),
      action: 'login',
    }
    appendActivityLog(entry)
    void postActivityLog({ username: user.username, action: 'login' })
  }, [user?.id, appendActivityLog, user])

  const handleClearActivityLog = useCallback(async () => {
    setActivityLog([])
    try {
      await fetch('/api/activity-log', { method: 'DELETE', credentials: 'include' })
    } catch (error) {
      console.error('Failed to clear activity logs from backend:', error)
    }
  }, [])

  const logThumbnailGeneration = useCallback(
    (entry: { details: string; estimatedCostUsd?: number; estimatedCostNote?: string }) => {
      if (!user) return
      const logEntry: ActivityLogEntry = {
        id: Date.now().toString(),
        username: user.username,
        timestamp: new Date().toISOString(),
        action: 'thumbnail_generation',
        details: entry.details,
        ...(entry.estimatedCostUsd !== undefined && Number.isFinite(entry.estimatedCostUsd)
          ? { estimatedCostUsd: entry.estimatedCostUsd }
          : {}),
        ...(entry.estimatedCostNote ? { estimatedCostNote: entry.estimatedCostNote } : {}),
      }
      appendActivityLog(logEntry)
      void postActivityLog({
        username: user.username,
        action: 'thumbnail_generation',
        details: entry.details,
        ...(entry.estimatedCostUsd !== undefined && Number.isFinite(entry.estimatedCostUsd)
          ? { estimatedCostUsd: entry.estimatedCostUsd }
          : {}),
        ...(entry.estimatedCostNote ? { estimatedCostNote: entry.estimatedCostNote } : {}),
      })
    },
    [appendActivityLog, user]
  )

  const logLogout = useCallback(() => {
    if (!user) return
    const entry: ActivityLogEntry = {
      id: Date.now().toString(),
      username: user.username,
      timestamp: new Date().toISOString(),
      action: 'logout',
    }
    appendActivityLog(entry)
    void postActivityLog({ username: user.username, action: 'logout' })
  }, [appendActivityLog, user])

  return {
    activityLog,
    setActivityLog,
    appendActivityLog,
    refreshActivityLog,
    handleClearActivityLog,
    logThumbnailGeneration,
    logLogout,
  }
}
