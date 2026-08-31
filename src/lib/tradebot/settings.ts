import { parseWatchlist, TRADEBOT_DEFAULT_WATCHLIST } from '@/lib/tradebot/canada'

function numEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]?.trim())
  return Number.isFinite(raw) && raw > 0 ? raw : fallback
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
    watchlist: parseWatchlist(process.env.TRADEBOT_WATCHLIST),
    model: tradebotGeminiModel(),
  }
}

export const DEFAULT_WATCHLIST_FALLBACK = [...TRADEBOT_DEFAULT_WATCHLIST]
