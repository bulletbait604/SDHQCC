import { parseWatchlist, TRADEBOT_DEFAULT_CRYPTO_WATCHLIST, TRADEBOT_DEFAULT_WATCHLIST } from '@/lib/tradebot/canada'

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

export type DeskMode = {
  deskEnabled: boolean
  liveAllowed: boolean
  placingLive: boolean
}

/** Pure rules: TRADEBOT_PAPER no longer blocks Real. UI liveMode does. */
export function resolveDeskMode(input: {
  paper: boolean
  liveEnv: boolean
  keys: boolean
  liveMode: boolean
}): DeskMode {
  const liveAllowed = input.liveEnv && input.keys
  return {
    deskEnabled: input.paper || input.keys,
    liveAllowed,
    placingLive: liveAllowed && input.liveMode,
  }
}

export function isTradebotPaperEnabled(): boolean {
  return boolEnv('TRADEBOT_PAPER', false)
}

export function krakenApiKey(): string {
  return (process.env.KRAKEN_API_KEY || '').trim()
}

export function krakenApiSecret(): string {
  return (process.env.KRAKEN_API_SECRET || '').trim()
}

export function isKrakenLiveConfigured(): boolean {
  return Boolean(krakenApiKey() && krakenApiSecret())
}

export function isKrakenLiveAllowed(): boolean {
  return resolveDeskMode({
    paper: isTradebotPaperEnabled(),
    liveEnv: boolEnv('TRADEBOT_LIVE', false),
    keys: isKrakenLiveConfigured(),
    liveMode: false,
  }).liveAllowed
}

/** Env + keys allow Real. Ledger liveMode must also be on. */
export function isPlacingLiveOrders(ledger: { liveMode?: boolean }): boolean {
  return resolveDeskMode({
    paper: isTradebotPaperEnabled(),
    liveEnv: boolEnv('TRADEBOT_LIVE', false),
    keys: isKrakenLiveConfigured(),
    liveMode: Boolean(ledger.liveMode),
  }).placingLive
}

/** @deprecated Use isKrakenLiveAllowed — does not mean the UI is on Real. */
export function isKrakenLiveActive(): boolean {
  return isKrakenLiveAllowed()
}

export function isTradebotDeskEnabled(): boolean {
  return resolveDeskMode({
    paper: isTradebotPaperEnabled(),
    liveEnv: boolEnv('TRADEBOT_LIVE', false),
    keys: isKrakenLiveConfigured(),
    liveMode: false,
  }).deskEnabled
}

export function tradebotGeminiModel(): string {
  return process.env.TRADEBOT_GEMINI_MODEL?.trim() || 'gemini-2.5-flash'
}

export function tradebotGeminiKey(): string {
  return (process.env.GEMINI_API || process.env.GOOGLE_API_KEY || '').trim()
}

export function getTradebotSettings() {
  const configuredStart = numEnv('TRADEBOT_STARTING_CAD', 100)
  const cryptoOnly = boolEnv('TRADEBOT_CRYPTO_ONLY', true)
  const dailyProfitTargetMinPct = Math.min(200, Math.max(1, numEnv('TRADEBOT_DAILY_PROFIT_MIN_PCT', 8)))
  const configuredMax = numEnv('TRADEBOT_DAILY_PROFIT_MAX_PCT', 200)
  const dailyProfitTargetMaxPct = Math.max(
    dailyProfitTargetMinPct,
    Math.min(200, configuredMax === 10 ? 200 : configuredMax)
  )
  return {
    paper: isTradebotPaperEnabled(),
    startingCad: configuredStart === 100_000 ? 100 : configuredStart,
    maxDrawdownPct: Math.min(25, Math.max(1, numEnv('TRADEBOT_MAX_DRAWDOWN_PCT', 8))),
    maxAssetWeightPct: numEnv('TRADEBOT_MAX_ASSET_WEIGHT', 20),
    riskPct: numEnv('TRADEBOT_RISK_PCT', 2),
    stopPct: Math.min(8, Math.max(0.5, numEnv('TRADEBOT_STOP_PCT', 1.5))) / 100,
    takePct: Math.min(20, Math.max(1, numEnv('TRADEBOT_TAKE_PCT', 3))) / 100,
    atrMultiplier: numEnv('TRADEBOT_ATR_MULTIPLIER', 2),
    tsxFeeBps: numEnv('TRADEBOT_TSX_FEE_BPS', 10),
    krakenFeeBps: numEnv('TRADEBOT_KRAKEN_FEE_BPS', 40),
    dailyProfitTargetMinPct,
    dailyProfitTargetMaxPct,
    cycleMinutes: Math.min(180, Math.max(15, numEnv('TRADEBOT_CYCLE_MINUTES', 60))),
    tickSeconds: Math.min(30, Math.max(5, numEnv('TRADEBOT_TICK_SECONDS', 8))),
    liveWatch: boolEnv('TRADEBOT_LIVE_WATCH', true),
    maxOpenPositions: Math.min(8, Math.max(1, numEnv('TRADEBOT_MAX_OPEN', 4))),
    krakenOnly: boolEnv('TRADEBOT_KRAKEN_ONLY', true),
    liveAllowed: isKrakenLiveAllowed(),
    live: isKrakenLiveAllowed(),
    cryptoOnly,
    watchlist: parseWatchlist(
      cryptoOnly ? process.env.TRADEBOT_CRYPTO_WATCHLIST : process.env.TRADEBOT_WATCHLIST,
      cryptoOnly ? TRADEBOT_DEFAULT_CRYPTO_WATCHLIST : TRADEBOT_DEFAULT_WATCHLIST
    ),
    scanAll: cryptoOnly ? false : boolEnv('TRADEBOT_SCAN_ALL', true),
    cryptoEnabled: boolEnv('TRADEBOT_CRYPTO', true),
    scanBatch: Math.min(400, Math.max(40, numEnv('TRADEBOT_SCAN_BATCH', 180))),
    shortlistStocks: Math.min(20, Math.max(4, numEnv('TRADEBOT_SHORTLIST_STOCKS', 8))),
    shortlistCrypto: Math.min(28, Math.max(8, numEnv('TRADEBOT_SHORTLIST_CRYPTO', 20))),
    model: tradebotGeminiModel(),
  }
}

export const DEFAULT_WATCHLIST_FALLBACK = [...TRADEBOT_DEFAULT_WATCHLIST]
