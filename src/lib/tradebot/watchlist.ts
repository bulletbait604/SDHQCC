/** Crypto assets tracked on Kraken (CAD) and CoinGecko. */
export const CRYPTO_WATCHLIST = [
  { symbol: 'BTC', krakenPair: 'XXBTZCAD', coingeckoId: 'bitcoin', label: 'Bitcoin' },
  { symbol: 'ETH', krakenPair: 'XETHZCAD', coingeckoId: 'ethereum', label: 'Ethereum' },
  { symbol: 'SOL', krakenPair: 'SOLCAD', coingeckoId: 'solana', label: 'Solana' },
  { symbol: 'XRP', krakenPair: 'XXRPZCAD', coingeckoId: 'ripple', label: 'XRP' },
] as const

/** US stocks/ETFs commonly held on TD Direct Investing. */
export const STOCK_WATCHLIST = [
  { symbol: 'IBIT', label: 'iShares Bitcoin ETF' },
  { symbol: 'FBTC', label: 'Fidelity Bitcoin ETF' },
  { symbol: 'ETHA', label: 'iShares Ethereum ETF' },
  { symbol: 'QQQ', label: 'Invesco QQQ' },
  { symbol: 'SPY', label: 'SPDR S&P 500 ETF' },
] as const

/** Flag intraday moves above this % on stocks (unusual move, not arb). */
export const STOCK_UNUSUAL_MOVE_PCT = 3

/** Minimum |net edge| in bps to surface crypto cross-venue gaps. */
export const CRYPTO_MIN_NET_EDGE_BPS = 25
