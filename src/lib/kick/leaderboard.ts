export type KickLeaderboardEntry = {
  rank: number
  userId: string | null
  username: string
  quantity: number
  profileUrl: string
}

export type KickLeaderboardPeriod = {
  week: KickLeaderboardEntry[]
  month: KickLeaderboardEntry[]
  lifetime: KickLeaderboardEntry[]
  enabled: boolean
}

export type KickLeaderboard = {
  giftedSubs: KickLeaderboardPeriod
  kicks: KickLeaderboardPeriod
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

export function emptyPeriod(): KickLeaderboardPeriod {
  return { week: [], month: [], lifetime: [], enabled: false }
}

export function emptyKickLeaderboard(): KickLeaderboard {
  return { giftedSubs: emptyPeriod(), kicks: emptyPeriod() }
}

function firstList(nested: Record<string, unknown>, keys: string[]): KickLeaderboardEntry[] {
  for (const key of keys) {
    const mapped = mapEntries(nested[key])
    if (mapped.length) return mapped
  }
  return []
}

function parsePeriod(
  nested: Record<string, unknown>,
  keys: { week: string[]; month: string[]; lifetime: string[]; enabled: string[] }
): KickLeaderboardPeriod {
  const week = firstList(nested, keys.week)
  const month = firstList(nested, keys.month)
  const lifetime = firstList(nested, keys.lifetime)
  return {
    week,
    month,
    lifetime,
    enabled: keys.enabled.some((key) => asBool(nested[key])) || week.length + month.length + lifetime.length > 0,
  }
}

export function parseGiftedSubsLeaderboard(payload: unknown): KickLeaderboardPeriod {
  const root = asRecord(payload)
  const nested = asRecord(root?.data) || root
  if (!nested) return emptyPeriod()
  return parsePeriod(nested, {
    week: ['gifts_week', 'weekly_leaderboard'],
    month: ['gifts_month', 'monthly_leaderboard'],
    lifetime: ['gifts', 'leaderboard', 'lifetime'],
    enabled: ['gifts_enabled', 'gifts_week_enabled', 'gifts_month_enabled'],
  })
}

export function parseKicksLeaderboard(payload: unknown): KickLeaderboardPeriod {
  const root = asRecord(payload)
  const nested = asRecord(root?.data) || root
  if (!nested) return emptyPeriod()
  return parsePeriod(nested, {
    week: ['kicks_gifts_week', 'kicks_week', 'week', 'gifts_week'],
    month: ['kicks_gifts_month', 'kicks_month', 'month', 'gifts_month'],
    lifetime: ['kicks_gifts_lifetime', 'kicks_lifetime', 'lifetime', 'gifts'],
    enabled: [
      'kicks_gifts_week_enabled',
      'kicks_gifts_month_enabled',
      'kicks_gifts_lifetime_enabled',
      'gifts_enabled',
    ],
  })
}

export function parseKickLeaderboard(payload: unknown): KickLeaderboard {
  return {
    giftedSubs: parseGiftedSubsLeaderboard(payload),
    kicks: emptyPeriod(),
  }
}
