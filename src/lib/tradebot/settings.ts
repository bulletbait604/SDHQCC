import { parseWatchlist, TRADEBOT_DEFAULT_WATCHLIST } from '@/lib/tradebot/canada'

function numEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]?.trim())
  return Number.isFinite(raw) && raw > 0 ? raw : fallback
}

function boolEnv(name: string, fallback: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase()
  if (!v) return fallback
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true
  return fallback
}

export function isTradebotPaperEnabled(): boolean {
  const v = process.env.TRADEBOT_PAPER?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function tradebotGeminiModel(): string {
  return process.env.TRADEBOT_GEMINI_MODEL?.trim() || 'gemini-2.5-flash'
}

export function tradebotGeminiKey(): string {
  return (process.env.GEMINI_API || process.env.GOOGLE_API_KEY || '').trim()
}

export function getTradebotSettings() {
  const configuredStart = numEnv('TRADEBOT_STARTING_CAD', 100)
  return {
    paper: isTradebotPaperEnabled(),
    startingCad: configuredStart === 100_000 ? 100 : configuredStart,
    maxDrawdownPct: numEnv('TRADEBOT_MAX_DRAWDOWN_PCT', 5),
    maxAssetWeightPct: numEnv('TRADEBOT_MAX_ASSET_WEIGHT', 15),
    riskPct: numEnv('TRADEBOT_RISK_PCT', 1),
    atrMultiplier: numEnv('TRADEBOT_ATR_MULTIPLIER', 2),
    tsxFeeBps: numEnv('TRADEBOT_TSX_FEE_BPS', 10),
    krakenFeeBps: numEnv('TRADEBOT_KRAKEN_FEE_BPS', 40),
    watchlist: parseWatchlist(process.env.TRADEBOT_WATCHLIST),
    scanAll: boolEnv('TRADEBOT_SCAN_ALL', true),
    cryptoEnabled: boolEnv('TRADEBOT_CRYPTO', true),
    scanBatch: Math.min(400, Math.max(40, numEnv('TRADEBOT_SCAN_BATCH', 180))),
    shortlistStocks: Math.min(20, Math.max(4, numEnv('TRADEBOT_SHORTLIST_STOCKS', 8))),
    shortlistCrypto: Math.min(16, Math.max(2, numEnv('TRADEBOT_SHORTLIST_CRYPTO', 8))),
    model: tradebotGeminiModel(),
  }
}

export const DEFAULT_WATCHLIST_FALLBACK = [...TRADEBOT_DEFAULT_WATCHLIST]
