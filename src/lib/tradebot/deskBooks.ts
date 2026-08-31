export const PAPER_LEDGER_ID = 'cad-paper'
export const LIVE_LEDGER_ID = 'cad-kraken'
export const DESK_ID = 'cad-desk'

export function bookIdForMode(liveMode: boolean): string {
  return liveMode ? LIVE_LEDGER_ID : PAPER_LEDGER_ID
}

/** Kraken CAD is ZCAD. Sum leftover *CAD keys if the named field is missing. */
export function cadFromKrakenBalance(result: Record<string, unknown>): number {
  const named = Number(result.ZCAD ?? result.CAD ?? 0)
  if (Number.isFinite(named) && named > 0) return named
  let sum = 0
  for (const [key, raw] of Object.entries(result)) {
    if (!/CAD$/i.test(key)) continue
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) sum += n
  }
  if (sum > 0) return sum
  return Number.isFinite(named) && named >= 0 ? named : 0
}

export function applyKrakenCash<T extends { cash: number; startingEquity: number; dayStartEquity: number; dayStartDate: string }>(
  ledger: T,
  cad: number,
  today: string
): T {
  const cash = cad >= 0 ? cad : 0
  ledger.cash = cash
  if (!(ledger.startingEquity > 0)) {
    ledger.startingEquity = cash
    ledger.dayStartEquity = cash
    ledger.dayStartDate = today
  }
  return ledger
}
