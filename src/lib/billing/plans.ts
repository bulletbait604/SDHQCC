import catalog from './catalog.json'

export const BILLING_CURRENCY = catalog.currency

export const PRO_TRIAL_DAYS = catalog.trialDays
/** $0 billing cycle written onto plans created by scripts/create-paypal-plan.ts. */
export const PAYPAL_TRIAL_DAYS = catalog.paypalTrialDays

export const PRO_MONTHLY = catalog.proMonthly
export const PRO_ANNUAL = catalog.proAnnual
export const LIFETIME_PASS = catalog.lifetime

export const COIN_PACKS = catalog.coinPacks

export type CoinPackId = keyof typeof COIN_PACKS

export type SubscriptionInterval = 'month' | 'year'

export const FREE_DAILY_ANALYSIS_QUOTA = catalog.freeDailyQuota.analysis
export const FREE_DAILY_TAG_QUOTA = catalog.freeDailyQuota.tagGenerator

const CAD_FORMAT = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
})

export function formatCad(amount: number): string {
  return CAD_FORMAT.format(amount)
}

export function coinPack(id: string): (typeof COIN_PACKS)[CoinPackId] | undefined {
  if (id in COIN_PACKS) return COIN_PACKS[id as CoinPackId]
  return undefined
}

export function listCoinPacks(): Array<{ id: CoinPackId } & (typeof COIN_PACKS)[CoinPackId]> {
  return (Object.keys(COIN_PACKS) as CoinPackId[]).map((id) => ({ id, ...COIN_PACKS[id] }))
}

export function subscriptionPlan(interval: SubscriptionInterval) {
  return interval === 'year' ? PRO_ANNUAL : PRO_MONTHLY
}

/** Amounts the currency quote endpoint should convert, in catalog order. */
export function checkoutQuoteAmountsCad(): string {
  return [PRO_MONTHLY.priceCad, PRO_ANNUAL.priceCad, LIFETIME_PASS.priceCad].join(',')
}

export type PayPalBillingCycle = {
  frequency: { interval_unit: string; interval_count: number }
  tenure_type: 'TRIAL' | 'REGULAR'
  sequence: number
  total_cycles: number
  pricing_scheme: { fixed_price: { value: string; currency_code: string } }
}

/**
 * PayPal subscription plans support a trial as a billing cycle.
 * The JS SDK only sends `plan_id`, so the trial has to live on the plan itself.
 */
export function paypalBillingCycles(interval: SubscriptionInterval): PayPalBillingCycle[] {
  const plan = subscriptionPlan(interval)
  const cycles: PayPalBillingCycle[] = []
  if (PAYPAL_TRIAL_DAYS > 0) {
    cycles.push({
      frequency: { interval_unit: 'DAY', interval_count: PAYPAL_TRIAL_DAYS },
      tenure_type: 'TRIAL',
      sequence: 1,
      total_cycles: 1,
      pricing_scheme: {
        fixed_price: { value: '0.00', currency_code: BILLING_CURRENCY },
      },
    })
  }
  cycles.push({
    frequency: {
      interval_unit: plan.intervalUnit,
      interval_count: plan.intervalCount,
    },
    tenure_type: 'REGULAR',
    sequence: cycles.length + 1,
    total_cycles: 0,
    pricing_scheme: {
      fixed_price: {
        value: plan.priceCad.toFixed(2),
        currency_code: BILLING_CURRENCY,
      },
    },
  })
  return cycles
}
