import type { Gw2AchievementRow } from './types'

export function filterAchievements(
  items: readonly Gw2AchievementRow[],
  options: { query?: string; groupId?: number | 'all'; status?: 'all' | 'completed' | 'incomplete' }
): Gw2AchievementRow[] {
  const q = (options.query || '').trim().toLowerCase()
  const groupId = options.groupId ?? 'all'
  const status = options.status || 'all'
  return items.filter((row) => {
    if (groupId !== 'all' && row.groupId !== groupId) return false
    if (status === 'completed' && !row.done) return false
    if (status === 'incomplete' && row.done) return false
    if (!q) return true
    return (
      row.name.toLowerCase().includes(q) ||
      row.groupName.toLowerCase().includes(q) ||
      row.categoryName.toLowerCase().includes(q) ||
      String(row.id).includes(q)
    )
  })
}
