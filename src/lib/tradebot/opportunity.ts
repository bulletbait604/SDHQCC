export const MAJOR_CRYPTO = new Set(['BTC-CAD', 'ETH-CAD'])
export const MAJOR_EQUITY = new Set(['VFV.TO', 'XQQ.TO', 'XIU.TO'])

export type OpportunityInput = {
  dayChangePct: number
  barsCount: number
  isNewListing: boolean
  assetClass: 'equity' | 'crypto'
  symbol: string
  newsTone?: 'positive' | 'negative' | 'mixed' | 'quiet'
}

export function isMajorName(symbol: string, assetClass: 'equity' | 'crypto'): boolean {
  const s = symbol.trim().toUpperCase()
  return assetClass === 'crypto' ? MAJOR_CRYPTO.has(s) : MAJOR_EQUITY.has(s)
}

/** Prefer upside in new names over chasing dumps in old majors. */
export function opportunityScore(input: OpportunityInput): number {
  const upside = Math.max(0, input.dayChangePct)
  const dump = Math.max(0, -input.dayChangePct)
  let score = upside * 1.5 - dump * 0.25
  if (input.isNewListing) score += 14
  if (input.barsCount > 0 && input.barsCount < 25) score += 9
  else if (input.barsCount >= 25 && input.barsCount < 60) score += 3
  if (input.assetClass === 'crypto' && !MAJOR_CRYPTO.has(input.symbol.toUpperCase())) score += 6
  if (isMajorName(input.symbol, input.assetClass)) score -= 3
  if (input.newsTone === 'positive') score += 5
  if (input.newsTone === 'negative') score -= 8
  return Number(score.toFixed(2))
}

export function isHighPotential(input: OpportunityInput): boolean {
  if (input.newsTone === 'negative') return false
  return input.isNewListing || (input.barsCount > 0 && input.barsCount < 40) || opportunityScore(input) >= 10
}

export function pickTopSymbols<T>(
  rows: T[],
  scoreOf: (row: T) => number,
  limit: number
): T[] {
  return [...rows].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, Math.max(0, limit))
}
