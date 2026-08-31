import { isMemeTicker, isMajorName } from '@/lib/tradebot/opportunity'

export function rankLiveBuys(
  markets: Array<{ symbol: string; dayChangePct: number; volume24h: number }>,
  held: Set<string>
): Array<{ symbol: string; dayChangePct: number; volume24h: number }> {
  return markets
    .filter((m) => {
      if (held.has(m.symbol)) return false
      if (!(m.dayChangePct >= 4 && m.dayChangePct <= 60)) return false
      if (!(m.volume24h > 0)) return false
      return true
    })
    .sort((a, b) => {
      const score = (m: { symbol: string; dayChangePct: number }) =>
        m.dayChangePct + (isMemeTicker(m.symbol) ? 18 : 0) - (isMajorName(m.symbol, 'crypto') ? 12 : 0)
      return score(b) - score(a)
    })
}
