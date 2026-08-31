/** Kraken Pro spot, lowest volume tier (CAD). Taker 0.80%, maker 0.40%. */

export const KRAKEN_TAKER_BPS_DEFAULT = 80
export const KRAKEN_MAKER_BPS_DEFAULT = 40
/** ~7× maker round-trip → take ≥ 5.6%, fees ~14% of a winner. */
export const MIN_TAKE_FEE_MULTIPLE = 7
/** Skip names whose bid/ask gap is wider than this percent of mid. */
export const MAX_SPREAD_PCT_DEFAULT = 0.45
export const STOP_COOLDOWN_MS = 30 * 60 * 1000
export const BUY_COOLDOWN_MS = 20 * 60 * 1000
export const STALE_ENTRY_MS = 15 * 60 * 1000

export function bpsToPct(bps: number): number {
  return bps / 10_000
}

export function roundTripPct(inBps: number, outBps: number): number {
  return bpsToPct(inBps) + bpsToPct(outBps)
}

/** Winner path is maker in + maker out. Refuse takes smaller than 7× that (~5.6%). */
export function minTakePct(makerBps = KRAKEN_MAKER_BPS_DEFAULT): number {
  return MIN_TAKE_FEE_MULTIPLE * roundTripPct(makerBps, makerBps)
}

/**
 * First price move where a trail of `trailPct` would still lock more than a
 * maker-in / taker-out round-trip. Trailing earlier scratches after fees.
 */
export function trailActivatePct(
  trailPct: number,
  makerBps = KRAKEN_MAKER_BPS_DEFAULT,
  takerBps = KRAKEN_TAKER_BPS_DEFAULT
): number {
  const lockPct = roundTripPct(makerBps, takerBps)
  if (!(trailPct > 0) || trailPct >= 0.5) return lockPct + 0.02
  return (lockPct + trailPct) / (1 - trailPct)
}

export function spreadPct(bid: number, ask: number): number {
  if (!(bid > 0) || !(ask > 0) || ask < bid) return 999
  const mid = (ask + bid) / 2
  return ((ask - bid) / mid) * 100
}

export function feeBpsForKind(kind: 'maker' | 'taker', makerBps: number, takerBps: number): number {
  return kind === 'maker' ? makerBps : takerBps
}
