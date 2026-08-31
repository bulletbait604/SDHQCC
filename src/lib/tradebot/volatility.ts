import { minTakePct } from '@/lib/tradebot/fees'

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
  const floorTake = minTakePct()
  if (level === 'low') {
    return {
      level,
      label: 'Low',
      hint: 'BTC/ETH swing — most of the book on one ticket, 8% take',
      symbols: [...LOW_SYMBOLS] as string[],
      maxPairs: 4,
      fillNativeCadAlts: false,
      minDayChangePct: -0.4,
      maxDayChangePct: 3,
      rsiMin: 30,
      rsiMax: 52,
      requireEma: true,
      majorScoreBoost: 10,
      moveScoreBoost: 0.15,
      maxOpen: 1,
      stopPct: 0.018,
      takePct: Math.max(0.08, floorTake),
      trailPct: 0.018,
      maxSpreadPct: 0.25,
      maxAssetWeightPct: 80,
    }
  }
  if (level === 'high') {
    return {
      level,
      label: 'High',
      hint: 'Faster coins — most of the book on one swing, 12% take',
      symbols: [...HIGH_SYMBOLS] as string[],
      maxPairs: 18,
      fillNativeCadAlts: true,
      minDayChangePct: -2,
      maxDayChangePct: 10,
      rsiMin: 24,
      rsiMax: 48,
      requireEma: true,
      majorScoreBoost: -4,
      moveScoreBoost: 0.25,
      maxOpen: 1,
      stopPct: 0.025,
      takePct: Math.max(0.12, floorTake),
      trailPct: 0.025,
      maxSpreadPct: 0.45,
      maxAssetWeightPct: 70,
    }
  }
  return {
    level: 'medium' as const,
    label: 'Medium',
    hint: 'Liquid Kraken CAD — most of the book on one swing, 9% take',
    symbols: [...MEDIUM_SYMBOLS] as string[],
    maxPairs: 10,
    fillNativeCadAlts: true,
    minDayChangePct: -1,
    maxDayChangePct: 8,
    rsiMin: 26,
    rsiMax: 50,
    requireEma: true,
    majorScoreBoost: 2,
    moveScoreBoost: 0.2,
    maxOpen: 1,
    stopPct: 0.02,
    takePct: Math.max(0.09, floorTake),
    trailPct: 0.02,
    maxSpreadPct: 0.35,
    maxAssetWeightPct: 75,
  }
}

export type VolatilityProfile = ReturnType<typeof volatilityProfile>
