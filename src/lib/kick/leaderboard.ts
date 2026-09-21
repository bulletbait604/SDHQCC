export type KickLeaderboardEntry = {
  rank: number
  userId: string | null
  username: string
  quantity: number
  profileUrl: string
}

export type KickLeaderboard = {
  lifetime: KickLeaderboardEntry[]
  month: KickLeaderboardEntry[]
  week: KickLeaderboardEntry[]
  giftsEnabled: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function asBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1
}

function mapEntries(value: unknown): KickLeaderboardEntry[] {
  const rows = Array.isArray(value) ? value : asRecord(value)?.data
  const list = Array.isArray(rows) ? rows : []
  const out: KickLeaderboardEntry[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const rec = asRecord(item)
    if (!rec) continue
    const username = asString(rec.username) || asString(rec.name)
    if (!username) continue
    const key = username.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const quantity = asNumber(rec.quantity) ?? asNumber(rec.gifted_amount) ?? 0
    const rank = asNumber(rec.rank) ?? out.length + 1
    out.push({
      rank,
      userId: asString(rec.user_id) || (asNumber(rec.user_id) != null ? String(asNumber(rec.user_id)) : null),
      username,
      quantity,
      profileUrl: `https://kick.com/${encodeURIComponent(username)}`,
    })
  }
  return out.slice(0, 10)
}

export function emptyKickLeaderboard(): KickLeaderboard {
  return { lifetime: [], month: [], week: [], giftsEnabled: false }
}

export function parseKickLeaderboard(payload: unknown): KickLeaderboard {
  const root = asRecord(payload)
  const nested = asRecord(root?.data) || root
  if (!nested) return emptyKickLeaderboard()
  const lifetime = mapEntries(nested.gifts || nested.lifetime)
  const month = mapEntries(nested.gifts_month || nested.month)
  const week = mapEntries(nested.gifts_week || nested.week)
  return {
    lifetime,
    month,
    week,
    giftsEnabled:
      asBool(nested.gifts_enabled) ||
      asBool(nested.gifts_week_enabled) ||
      asBool(nested.gifts_month_enabled) ||
      lifetime.length + month.length + week.length > 0,
  }
}
