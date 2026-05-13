/**
 * Daily free coins refresh to DAILY_FREE_COINS (not cumulative).
 * "Sticky" balance is anything from PayPal (tracked via purchasedBalance) or legacy min(coins, totalPurchased).
 */

export const DAILY_FREE_COINS = 10

type CoinBalanceLike = object

/** Coins that persist across the daily free refresh (purchases, migrated legacy). */
export function getPurchasedCoinBalance(doc: CoinBalanceLike | null | undefined): number {
  if (!doc || typeof doc !== 'object') return 0
  const o = doc as Record<string, unknown>
  const coins =
    typeof o.coins === 'number' && !Number.isNaN(o.coins) ? Math.max(0, o.coins) : 0
  if (typeof o.purchasedBalance === 'number' && !Number.isNaN(o.purchasedBalance)) {
    return Math.max(0, Math.min(o.purchasedBalance, coins))
  }
  const tp =
    typeof o.totalPurchased === 'number' && !Number.isNaN(o.totalPurchased)
      ? Math.max(0, o.totalPurchased)
      : 0
  return Math.min(coins, tp)
}

export function coinsAfterDailyRefresh(doc: CoinBalanceLike | null | undefined): {
  purchasedBalance: number
  newCoins: number
} {
  const purchasedBalance = getPurchasedCoinBalance(doc)
  return {
    purchasedBalance,
    newCoins: purchasedBalance + DAILY_FREE_COINS,
  }
}

/** Spend free (non-sticky) coins first, then purchasedBalance. */
export function splitCoinSpend(doc: CoinBalanceLike | null | undefined, cost: number): {
  newCoins: number
  purchasedBalance: number
} {
  const o = doc && typeof doc === 'object' ? (doc as Record<string, unknown>) : {}
  const coins =
    typeof o.coins === 'number' && !Number.isNaN(o.coins) ? o.coins : 0
  const pb = getPurchasedCoinBalance(doc)
  const daily = Math.max(0, coins - pb)
  const takeDaily = Math.min(cost, daily)
  const takePurchased = cost - takeDaily
  return {
    newCoins: coins - cost,
    purchasedBalance: Math.max(0, pb - takePurchased),
  }
}
