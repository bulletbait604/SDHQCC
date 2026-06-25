import type { ActivityLogEntry } from '@/lib/home/types'

export function formatActivityActionLabel(action: ActivityLogEntry['action']): string {
  if (action === 'token_grant') return 'coin grant'
  if (action === 'token_purchase') return 'coin purchase'
  return action.replace(/_/g, ' ')
}

export function formatEstimatedUsd(usd: number): string {
  if (!Number.isFinite(usd)) return '—'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(3)}`
}

export function normalizeActivityLogEntry(row: Record<string, unknown>): ActivityLogEntry | null {
  const username = typeof row.username === 'string' ? row.username : null
  const action = typeof row.action === 'string' ? row.action : null
  if (!username || !action) return null
  const id =
    typeof row.id === 'string'
      ? row.id
      : row._id != null
        ? String(row._id)
        : `${Date.now()}`
  const timestamp =
    typeof row.timestamp === 'string' ? row.timestamp : new Date().toISOString()
  const details = typeof row.details === 'string' ? row.details : undefined
  let estimatedCostUsd: number | undefined
  if (typeof row.estimatedCostUsd === 'number' && Number.isFinite(row.estimatedCostUsd)) {
    estimatedCostUsd = row.estimatedCostUsd
  }
  const estimatedCostNote =
    typeof row.estimatedCostNote === 'string' ? row.estimatedCostNote : undefined
  return {
    id,
    username,
    timestamp,
    action: action as ActivityLogEntry['action'],
    ...(details !== undefined ? { details } : {}),
    ...(estimatedCostUsd !== undefined ? { estimatedCostUsd } : {}),
    ...(estimatedCostNote !== undefined ? { estimatedCostNote } : {}),
  }
}

export async function postActivityLog(entry: {
  username: string
  action: ActivityLogEntry['action']
  details?: string
  estimatedCostUsd?: number
  estimatedCostNote?: string
}): Promise<void> {
  await fetch('/api/activity-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(entry),
  }).catch(() => {})
}
