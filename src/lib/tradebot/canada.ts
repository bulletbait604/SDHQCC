/** Canada-first TradeBot defaults. Not overridable to a US broker. */

export const TRADEBOT_REGION = 'CA' as const
export const TRADEBOT_BASE_CURRENCY = 'CAD' as const
export const TRADEBOT_TIMEZONE = 'America/Toronto'

/** TSX + NYSE cash session (same clock). */
export const TRADEBOT_SESSION = {
  openHour: 9,
  openMinute: 30,
  closeHour: 16,
  closeMinute: 0,
  timezone: TRADEBOT_TIMEZONE,
} as const

/**
 * Liquid CAD-listed names a Canadian account can actually buy.
 * VFV/XQQ = US index exposure in CAD. BTCC.B / ETHH.B = crypto ETFs in CAD.
 */
export const TRADEBOT_DEFAULT_WATCHLIST = [
  'VFV.TO',
  'XQQ.TO',
  'XIU.TO',
  'SHOP.TO',
  'BTCC.B.TO',
  'ETHH.B.TO',
] as const

export const TRADEBOT_DEFAULT_WATCHLIST_CSV = TRADEBOT_DEFAULT_WATCHLIST.join(',')

export function parseWatchlist(raw: string | undefined): string[] {
  const fromEnv = (raw || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  return fromEnv.length ? fromEnv : [...TRADEBOT_DEFAULT_WATCHLIST]
}
