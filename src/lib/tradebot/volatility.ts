export type VolatilityLevel = 'low' | 'medium' | 'high'

export const VOLATILITY_LEVELS: VolatilityLevel[] = ['low', 'medium', 'high']

const LOW_SYMBOLS = ['BTC-CAD', 'ETH-CAD', 'LTC-CAD', 'XRP-CAD'] as const
const MEDIUM_SYMBOLS = [...LOW_SYMBOLS, 'SOL-CAD', 'ADA-CAD', 'LINK-CAD', 'DOT-CAD', 'AVAX-CAD'] as const
const HIGH_SYMBOLS = [
  ...MEDIUM_SYMBOLS,
  'DOGE-CAD',
  'UNI-CAD',
  'ATOM-CAD',
  'NEAR-CAD',
  'SUI-CAD',
  'BCH-CAD',
  'XLM-CAD',
  'PEPE-CAD',
  'SHIB-CAD',
  'BONK-CAD',
  'WIF-CAD',
  'FLOKI-CAD',
] as const

const MAJORS = new Set(['BTC-CAD', 'ETH-CAD'])

export function parseVolatility(raw: unknown): VolatilityLevel {
  const v = String(raw || '').trim().toLowerCase()
  if (v === 'low' || v === 'high' || v === 'medium') return v
  return 'medium'
}

export function isMajorCad(symbol: string): boolean {
  return MAJORS.has(symbol.trim().toUpperCase())
}

export function volatilityProfile(level: VolatilityLevel) {
  if (level === 'low') {
    return {
      level,
      label: 'Low',
      hint: 'BTC, ETH, and other calmer coins',
      symbols: [...LOW_SYMBOLS] as string[],
      maxPairs: 4,
      fillNativeCadAlts: false,
      minDayChangePct: 0.15,
      maxDayChangePct: 5,
      rsiMin: 42,
      rsiMax: 62,
      requireEma: true,
      majorScoreBoost: 10,
      moveScoreBoost: 0.6,
      maxOpen: 2,
      stopPct: 0.012,
      takePct: 0.022,
      maxAssetWeightPct: 15,
    }
  }
  if (level === 'high') {
    return {
      level,
      label: 'High',
      hint: 'Faster coins with bigger swings',
      symbols: [...HIGH_SYMBOLS] as string[],
      maxPairs: 18,
      fillNativeCadAlts: true,
      minDayChangePct: 0.9,
      maxDayChangePct: 40,
      rsiMin: 32,
      rsiMax: 82,
      requireEma: false,
      majorScoreBoost: -6,
      moveScoreBoost: 1.8,
      maxOpen: 6,
      stopPct: 0.022,
      takePct: 0.055,
      maxAssetWeightPct: 20,
    }
  }
  return {
    level: 'medium' as const,
    label: 'Medium',
    hint: 'Liquid Kraken CAD mix',
    symbols: [...MEDIUM_SYMBOLS] as string[],
    maxPairs: 10,
    fillNativeCadAlts: false,
    minDayChangePct: 0.6,
    maxDayChangePct: 18,
    rsiMin: 38,
    rsiMax: 70,
    requireEma: true,
    majorScoreBoost: 2,
    moveScoreBoost: 1,
    maxOpen: 4,
    stopPct: 0.015,
    takePct: 0.03,
    maxAssetWeightPct: 20,
  }
}

export type VolatilityProfile = ReturnType<typeof volatilityProfile>
