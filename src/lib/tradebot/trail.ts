import { trailActivatePct, roundTripPct, KRAKEN_MAKER_BPS_DEFAULT, KRAKEN_TAKER_BPS_DEFAULT } from '@/lib/tradebot/fees'
import { getTradebotSettings } from '@/lib/tradebot/settings'

type TrailBook = {
  positions: Array<{ symbol: string; avgPrice: number; stopLoss: number }>
}

/** Ratchet the stop only once a trail would still lock more than a maker/taker round-trip. */
export function trailStops(
  ledger: TrailBook,
  prices: Record<string, number>,
  opts?: { activatePct?: number; trailPct?: number; makerBps?: number; takerBps?: number }
): string[] {
  const settings = getTradebotSettings()
  const makerBps = opts?.makerBps ?? settings.krakenMakerBps ?? KRAKEN_MAKER_BPS_DEFAULT
  const takerBps = opts?.takerBps ?? settings.krakenTakerBps ?? KRAKEN_TAKER_BPS_DEFAULT
  const trailPct = opts?.trailPct ?? Math.max(settings.stopPct * 0.7, 0.008)
  const activatePct = opts?.activatePct ?? trailActivatePct(trailPct, makerBps, takerBps)
  const lockPriceMult = 1 + roundTripPct(makerBps, takerBps)
  const moved: string[] = []
  for (const pos of ledger.positions) {
    const px = prices[pos.symbol]
    if (!(px > 0) || !(pos.avgPrice > 0)) continue
    const gain = (px - pos.avgPrice) / pos.avgPrice
    if (gain < activatePct) continue
    const trailed = Number((px * (1 - trailPct)).toFixed(6))
    const breakeven = Number((pos.avgPrice * lockPriceMult).toFixed(6))
    const next = Math.max(pos.stopLoss, trailed, breakeven)
    if (next > pos.stopLoss + 1e-9) {
      pos.stopLoss = next
      moved.push(pos.symbol)
    }
  }
  return moved
}
