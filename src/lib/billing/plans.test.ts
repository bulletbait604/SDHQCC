import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COIN_PACKS,
  LIFETIME_PASS,
  PRO_ANNUAL,
  PRO_MONTHLY,
  PRO_TRIAL_DAYS,
  paypalBillingCycles,
} from './plans'
import { isProTrialActive, trialEndsAtFrom } from './trial'
import { decideToolAccess, quotaBucketForTool } from './quotaRules'

test('catalog prices are the single published list', () => {
  assert.equal(PRO_MONTHLY.priceCad, 9.5)
  assert.equal(PRO_ANNUAL.priceCad, 79)
  assert.equal(LIFETIME_PASS.priceCad, 89.99)
  assert.equal(PRO_TRIAL_DAYS, 7)
  assert.deepEqual(
    Object.values(COIN_PACKS).map((pack) => [pack.coins, pack.priceCad]),
    [
      [12, 5],
      [30, 10],
      [80, 20],
    ]
  )
})

test('PayPal plans bill a 7-day free cycle before the regular price', () => {
  const monthly = paypalBillingCycles('month')
  assert.equal(monthly[0]?.tenure_type, 'TRIAL')
  assert.equal(monthly[0]?.frequency.interval_count, 7)
  assert.equal(monthly[0]?.pricing_scheme.fixed_price.value, '0.00')
  assert.equal(monthly[1]?.tenure_type, 'REGULAR')
  assert.equal(monthly[1]?.pricing_scheme.fixed_price.value, '9.50')
  assert.equal(monthly[1]?.pricing_scheme.fixed_price.currency_code, 'CAD')

  const annual = paypalBillingCycles('year')
  assert.equal(annual[1]?.frequency.interval_unit, 'YEAR')
  assert.equal(annual[1]?.pricing_scheme.fixed_price.value, '79.00')
})

test('app trial is active only until the end timestamp', () => {
  const start = new Date('2026-10-01T00:00:00.000Z')
  const ends = trialEndsAtFrom(start)
  assert.equal(ends.toISOString(), '2026-10-08T00:00:00.000Z')
  assert.equal(isProTrialActive(ends.toISOString(), new Date('2026-10-07T23:00:00.000Z')), true)
  assert.equal(isProTrialActive(ends.toISOString(), new Date('2026-10-08T00:00:00.000Z')), false)
  assert.equal(isProTrialActive(null), false)
})

test('free quota covers analyses and tags, and thumbnails stay on coins or Pro', () => {
  assert.equal(quotaBucketForTool('clip-analyzer'), 'analysis')
  assert.equal(quotaBucketForTool('tag-generator'), 'tags')
  assert.equal(quotaBucketForTool('thumbnail-generator'), null)
  assert.equal(quotaBucketForTool('post4me'), null)

  assert.equal(decideToolAccess({ pro: true, quotaLimit: 3, quotaUsed: 3, coinBalance: 0, coinCost: 2 }).via, 'pro')
  assert.equal(
    decideToolAccess({ pro: false, quotaLimit: 3, quotaUsed: 1, coinBalance: 0, coinCost: 2 }).via,
    'quota'
  )
  assert.equal(
    decideToolAccess({ pro: false, quotaLimit: 3, quotaUsed: 3, coinBalance: 2, coinCost: 2 }).via,
    'coins'
  )
  assert.equal(
    decideToolAccess({ pro: false, quotaLimit: null, quotaUsed: 0, coinBalance: 1, coinCost: 2 }).via,
    'denied'
  )
})
