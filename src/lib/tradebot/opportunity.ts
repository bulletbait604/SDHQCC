export const MAJOR_CRYPTO = new Set(['BTC-CAD', 'ETH-CAD'])
export const MAJOR_EQUITY = new Set(['VFV.TO', 'XQQ.TO', 'XIU.TO'])

const MEME_RE =
  /pepe|doge|shib|inu|floki|bonk|wif|mog|neiro|goat|popcat|wojak|trump|fart|meme|elon|kitty|hamster|moon|ponke|mew|pnut|ai16z|gigachad/i

export type OpportunityInput = {
  dayChangePct: number
  barsCount: number
  isNewListing: boolean
  assetClass: 'equity' | 'crypto'
  symbol: string
  newsTone?: 'positive' | 'negative' | 'mixed' | 'quiet'
  change1h?: number
  isMeme?: boolean
  isTrending?: boolean
}

export function isMemeTicker(symbol: string, name = ''): boolean {
  return MEME_RE.test(`${symbol} ${name}`)
}

export function isMajorName(symbol: string, assetClass: 'equity' | 'crypto'): boolean {
  const s = symbol.trim().toUpperCase()
  return assetClass === 'crypto' ? MAJOR_CRYPTO.has(s) : MAJOR_EQUITY.has(s)
}

/** 1h/24h continuation for memes and new coins. */
export function shortTermScore(input: {
  change1h: number
  change24h: number
  volumeCad: number
  isMeme: boolean
  isTrending: boolean
  isNew: boolean
  symbol: string
}): number {
  const hour = Math.max(0, input.change1h) * 2.4 + Math.min(0, input.change1h) * 0.4
  const day = Math.max(0, input.change24h) * 1.1 + Math.min(0, input.change24h) * 0.2
  let score = hour + day + Math.log10(Math.max(input.volumeCad, 10))
  if (input.isMeme) score += 12
  if (input.isTrending) score += 14
  if (input.isNew) score += 16
  if (MAJOR_CRYPTO.has(input.symbol.toUpperCase())) score -= 8
  return Number(score.toFixed(2))
}

/** Prefer upside in new names over chasing dumps in old majors. */
export function opportunityScore(input: OpportunityInput): number {
  const upside = Math.max(0, input.dayChangePct)
  const dump = Math.max(0, -input.dayChangePct)
  const hour = Math.max(0, input.change1h || 0) * 2
  let score = upside * 1.5 - dump * 0.25 + hour
  if (input.isNewListing) score += 14
  if (input.isMeme) score += 12
  if (input.isTrending) score += 10
  if (input.barsCount > 0 && input.barsCount < 25) score += 9
  else if (input.barsCount >= 25 && input.barsCount < 60) score += 3
  if (input.assetClass === 'crypto' && !MAJOR_CRYPTO.has(input.symbol.toUpperCase())) score += 6
  if (isMajorName(input.symbol, input.assetClass)) score -= 3
  if (input.newsTone === 'positive') score += 5
  if (input.newsTone === 'negative') score -= 12
  return Number(score.toFixed(2))
}

export function isHighPotential(input: OpportunityInput): boolean {
  if (input.newsTone === 'negative') return false
  if (input.isMeme && (input.change1h || 0) > 2) return true
  return (
    input.isNewListing ||
    Boolean(input.isTrending) ||
    (input.barsCount > 0 && input.barsCount < 40) ||
    opportunityScore(input) >= 10
  )
}

export function pickTopSymbols<T>(
  rows: T[],
  scoreOf: (row: T) => number,
  limit: number
): T[] {
  return [...rows].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, Math.max(0, limit))
}
