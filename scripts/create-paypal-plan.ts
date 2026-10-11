#!/usr/bin/env tsx
/**
 * Create PayPal billing plans from src/lib/billing/catalog.json.
 *
 * Does not change existing plans or env vars. Prints the new Plan IDs to set yourself.
 *
 *   npm run create-paypal-plan
 *   npm run create-paypal-plan:sandbox
 *
 * Live uses PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET.
 * Sandbox uses PAYPAL_CLIENT_ID_SANDBOX + PAYPAL_CLIENT_SECRET_SANDBOX
 * (or pass --sandbox / PAYPAL_MODE=sandbox).
 */

import {
  BILLING_CURRENCY,
  PRO_ANNUAL,
  PRO_MONTHLY,
  PAYPAL_TRIAL_DAYS,
  paypalBillingCycles,
  type SubscriptionInterval,
} from '../src/lib/billing/plans'

type CreatedPlan = {
  interval: SubscriptionInterval
  id: string
  envKey: string
}

async function paypalFetch(baseUrl: string, accessToken: string, path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`${path} failed (${response.status}): ${error}`)
  }
  return response.json() as Promise<{ id: string; name?: string; status?: string }>
}

async function createPayPalPlans() {
  const sandboxFlag = process.argv.includes('--sandbox') || process.env.PAYPAL_MODE === 'sandbox'
  const clientId = sandboxFlag ? process.env.PAYPAL_CLIENT_ID_SANDBOX : process.env.PAYPAL_CLIENT_ID
  const clientSecret = sandboxFlag
    ? process.env.PAYPAL_CLIENT_SECRET_SANDBOX
    : process.env.PAYPAL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error(
      `Missing ${sandboxFlag ? 'PAYPAL_CLIENT_ID_SANDBOX and PAYPAL_CLIENT_SECRET_SANDBOX' : 'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET'}`
    )
    process.exit(1)
  }

  const baseUrl = sandboxFlag ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
  console.log(`Creating PayPal ${sandboxFlag ? 'sandbox' : 'LIVE'} product and plans from the billing catalog.`)
  console.log(
    `Prices: Pro ${PRO_MONTHLY.priceCad.toFixed(2)} ${BILLING_CURRENCY}/month, Pro Annual ${PRO_ANNUAL.priceCad.toFixed(2)} ${BILLING_CURRENCY}/year, ${PAYPAL_TRIAL_DAYS}-day $0 PayPal trial cycle.\n`
  )

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!tokenResponse.ok) {
    throw new Error(`Failed to get access token: ${tokenResponse.status} ${await tokenResponse.text()}`)
  }
  const tokenData = (await tokenResponse.json()) as { access_token: string }
  const accessToken = tokenData.access_token

  const product = await paypalFetch(baseUrl, accessToken, '/v1/catalogs/products', {
    name: 'Stream Dreams Creator Corner Pro',
    description: 'Pro access to Stream Dreams Creator Corner',
    type: 'SERVICE',
    category: 'SOFTWARE',
    home_url: 'https://sdcreatorcorner.com',
  })
  console.log('Product:', product.id)

  const specs: Array<{ interval: SubscriptionInterval; name: string; description: string; envKey: string }> = [
    {
      interval: 'month',
      name: PRO_MONTHLY.name,
      description: `Pro monthly access. ${PAYPAL_TRIAL_DAYS}-day free trial, then ${PRO_MONTHLY.priceCad.toFixed(2)} ${BILLING_CURRENCY}/month.`,
      envKey: sandboxFlag ? PRO_MONTHLY.envSandbox : PRO_MONTHLY.envLive,
    },
    {
      interval: 'year',
      name: PRO_ANNUAL.name,
      description: `Pro annual access. ${PAYPAL_TRIAL_DAYS}-day free trial, then ${PRO_ANNUAL.priceCad.toFixed(2)} ${BILLING_CURRENCY}/year.`,
      envKey: sandboxFlag ? PRO_ANNUAL.envSandbox : PRO_ANNUAL.envLive,
    },
  ]

  const created: CreatedPlan[] = []
  for (const spec of specs) {
    const plan = await paypalFetch(baseUrl, accessToken, '/v1/billing/plans', {
      product_id: product.id,
      name: spec.name,
      description: spec.description,
      status: 'ACTIVE',
      billing_cycles: paypalBillingCycles(spec.interval),
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: '0', currency_code: BILLING_CURRENCY },
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3,
      },
      taxes: { percentage: '0', inclusive: false },
    })
    created.push({ interval: spec.interval, id: plan.id, envKey: spec.envKey })
    console.log(`Plan ${spec.interval}: ${plan.id}`)
  }

  console.log('\nNew plans were created. Existing subscribers stay on their current PayPal plan.')
  console.log('Set these env vars yourself, then redeploy. This script does not write env vars.\n')
  for (const plan of created) {
    console.log(`${plan.envKey}=${plan.id}`)
  }
}

createPayPalPlans().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
})
