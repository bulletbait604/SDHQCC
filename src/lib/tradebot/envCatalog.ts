export type TradebotEnvGroup = 'already' | 'required' | 'optional'

export type TradebotProviderStatus = {
  id: string
  group: TradebotEnvGroup
  label: string
  keys: string[]
  purpose: string
  accountUrl?: string
  configured: boolean
}

export type TradebotEnvItem = {
  id: string
  group: TradebotEnvGroup
  label: string
  keys: string[]
  purpose: string
  accountUrl?: string
  /** True when every listed key must be present (e.g. key + secret). */
  requireAll?: boolean
}

/** Names only — never put secrets here. Canada-first: no Alpaca. */
export const TRADEBOT_ENV_CATALOG: TradebotEnvItem[] = [
  {
    id: 'gemini',
    group: 'already',
    label: 'Google Gemini',
    keys: ['GEMINI_API', 'GOOGLE_API_KEY'],
    purpose: 'Agent reasoning. Reuse the key this app already uses.',
  },
  {
    id: 'mongodb',
    group: 'already',
    label: 'MongoDB',
    keys: ['MONGODB_URI'],
    purpose: 'CAD paper ledger, trade history, and audit logs.',
  },
  {
    id: 'fx',
    group: 'already',
    label: 'Frankfurter FX',
    keys: [],
    purpose: 'CAD/USD (no key). Used so US-listed prints convert into CAD NAV.',
  },
  {
    id: 'kraken-public',
    group: 'already',
    label: 'Kraken public',
    keys: [],
    purpose: 'CAD crypto reference prices when CoinGecko names also trade on Kraken. No key.',
  },
  {
    id: 'coingecko',
    group: 'already',
    label: 'CoinGecko Demo',
    keys: ['COINGECKO_DEMO_API_KEY', 'COINGECKO_API_KEY', 'COINGECKO_PRO_API_KEY'],
    purpose:
      'Free Demo API (api.coingecko.com). A Demo key in any of those names raises the rate limit. Do not set COINGECKO_USE_PRO unless you paid for Pro.',
    accountUrl: 'https://www.coingecko.com/en/api/pricing',
  },
  {
    id: 'quotes',
    group: 'already',
    label: 'Yahoo / Stooq quotes',
    keys: [],
    purpose: 'Unused while TRADEBOT_CRYPTO_ONLY=true. TSX/TSXV Yahoo/Stooq path.',
  },
  {
    id: 'paper-flag',
    group: 'required',
    label: 'Canada paper flag',
    keys: ['TRADEBOT_PAPER'],
    purpose: 'Must be true. Live IBKR/Kraken orders stay off until you explicitly change this.',
  },
  {
    id: 'finnhub',
    group: 'optional',
    label: 'Finnhub',
    keys: ['Finnhub_API', 'FINNHUB_API_KEY'],
    purpose:
      'Skip. Free tier is US-only, often rate-limited, and does not include TSX without a paid Canada package.',
    accountUrl: 'https://finnhub.io/register',
  },
  {
    id: 'model',
    group: 'optional',
    label: 'Gemini model override',
    keys: ['TRADEBOT_GEMINI_MODEL'],
    purpose: 'Defaults to gemini-2.5-flash.',
  },
  {
    id: 'risk',
    group: 'optional',
    label: 'Hard risk limits',
    keys: [
      'TRADEBOT_MAX_DRAWDOWN_PCT',
      'TRADEBOT_MAX_ASSET_WEIGHT',
      'TRADEBOT_RISK_PCT',
      'TRADEBOT_WATCHLIST',
      'TRADEBOT_CRYPTO_WATCHLIST',
      'TRADEBOT_CYCLE_MINUTES',
      'TRADEBOT_STARTING_CAD',
      'TRADEBOT_SCAN_ALL',
      'TRADEBOT_CRYPTO',
      'TRADEBOT_CRYPTO_ONLY',
      'TRADEBOT_SCAN_BATCH',
      'TRADEBOT_SHORTLIST_STOCKS',
      'TRADEBOT_SHORTLIST_CRYPTO',
      'COINGECKO_API_KEY',
      'COINGECKO_DEMO_API_KEY',
      'COINGECKO_PRO_API_KEY',
      'COINGECKO_USE_PRO',
    ],
    purpose: 'Defaults: crypto-only CAD paper, hunt new/meme coins, 5% daily halt, 15% max per name, CA$100.',
  },
  {
    id: 'ibkr',
    group: 'optional',
    label: 'Interactive Brokers Canada',
    keys: ['IBKR_USERNAME', 'IBKR_ACCOUNT_ID', 'IBKR_GATEWAY_HOST'],
    purpose:
      'Only path for automated TSX/US stock orders from Canada. Needs a paper account + Client Portal Gateway (not Vercel). Skip until CAD paper in-app looks sane.',
    accountUrl: 'https://www.interactivebrokers.ca/en/home.php',
  },
  {
    id: 'kraken-trade',
    group: 'optional',
    label: 'Kraken (CAD crypto)',
    keys: ['KRAKEN_API_KEY', 'KRAKEN_API_SECRET'],
    purpose: 'Canadian-legal crypto execution with CAD funding. Not used while TRADEBOT_PAPER=true.',
    accountUrl: 'https://www.kraken.com/',
    requireAll: true,
  },
  {
    id: 'bitbuy',
    group: 'optional',
    label: 'Bitbuy',
    keys: ['BITBUY_API_KEY', 'BITBUY_API_SECRET'],
    purpose: 'CAD crypto venue. Partner API must be approved by Bitbuy first.',
    accountUrl: 'https://bitbuy.ca/',
    requireAll: true,
  },
  {
    id: 'questrade',
    group: 'optional',
    label: 'Questrade (read-only)',
    keys: ['QUESTTRADE_REFRESH_TOKEN'],
    purpose:
      'Retail Questrade cannot place API orders (partner-only). Token is for balances/positions sync, not execution.',
    accountUrl: 'https://www.questrade.com/api',
  },
  {
    id: 'fees',
    group: 'optional',
    label: 'Venue fees',
    keys: ['TRADEBOT_KRAKEN_FEE_BPS', 'TRADEBOT_BITBUY_FEE_BPS', 'TRADEBOT_TSX_FEE_BPS'],
    purpose: 'Taker fees in basis points for net-edge math (defaults 40 / 20 / 10).',
  },
]

export function envKeysPresent(keys: string[], requireAll = false): boolean {
  if (keys.length === 0) return true
  const hits = keys.map((k) => Boolean(process.env[k]?.trim()))
  return requireAll ? hits.every(Boolean) : hits.some(Boolean)
}
