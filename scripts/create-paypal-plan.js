#!/usr/bin/env node

/**
 * Script to create a PayPal Product and Plan
 * Run: node scripts/create-paypal-plan.js
 * 
 * Set PAYPAL_MODE=sandbox for sandbox, or omit for production
 */

async function createPayPalPlan() {
  const isSandbox = process.env.PAYPAL_MODE === 'sandbox'
  const clientId = isSandbox ? process.env.PAYPAL_CLIENT_ID_SANDBOX : process.env.PAYPAL_CLIENT_ID
  const clientSecret = isSandbox ? process.env.PAYPAL_CLIENT_SECRET_SANDBOX : process.env.PAYPAL_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    console.error(`❌ Error: ${isSandbox ? 'PAYPAL_CLIENT_ID_SANDBOX and PAYPAL_CLIENT_SECRET_SANDBOX' : 'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET'} must be set`)
    console.log('\nAdd these to your environment:')
    if (isSandbox) {
      console.log('PAYPAL_CLIENT_ID_SANDBOX=your_sandbox_client_id')
      console.log('PAYPAL_CLIENT_SECRET_SANDBOX=your_sandbox_client_secret')
    } else {
      console.log('PAYPAL_CLIENT_ID=your_live_client_id')
      console.log('PAYPAL_CLIENT_SECRET=your_live_client_secret')
    }
    process.exit(1)
  }
  
  console.log(`🔄 Creating PayPal ${isSandbox ? 'Sandbox' : 'LIVE'} Product and Plan...\n`)
  
  try {
    // Step 1: Get access token
    console.log('Step 1: Getting access token...')
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    
    const baseUrl = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
    
    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    
    if (!tokenResponse.ok) {
      throw new Error(`Failed to get access token: ${tokenResponse.status}`)
    }
    
    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token
    console.log('✅ Access token obtained\n')
    
    // Step 2: Create Product
    console.log('Step 2: Creating product...')
    const productResponse = await fetch(`${baseUrl}/v1/catalogs/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Stream Dreams Creator Corner Subscription',
        description: 'Monthly subscription for premium features',
        type: 'SERVICE',
        category: 'SOFTWARE',
        image_url: 'https://sdhqcc.vercel.app/logo.png',
        home_url: 'https://sdhqcc.vercel.app'
      }),
    })
    
    if (!productResponse.ok) {
      const error = await productResponse.text()
      throw new Error(`Failed to create product: ${error}`)
    }
    
    const product = await productResponse.json()
    console.log('✅ Product created:', product.id)
    console.log('   Name:', product.name)
    console.log('   Description:', product.description, '\n')
    
    // Step 3: Create Plan
    console.log('Step 3: Creating subscription plan...')
    const planResponse = await fetch(`${baseUrl}/v1/billing/plans`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        product_id: product.id,
        name: 'Monthly Subscription',
        description: 'Monthly access to Stream Dreams Creator Corner premium features',
        status: 'ACTIVE',
        billing_cycles: [
          {
            frequency: {
              interval_unit: 'MONTH',
              interval_count: 1
            },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: {
                value: '4.99',
                currency_code: 'CAD'
              }
            }
          }
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: {
            value: '0',
            currency_code: 'CAD'
          },
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3
        },
        taxes: {
          percentage: '0',
          inclusive: false
        }
      }),
    })
    
    if (!planResponse.ok) {
      const error = await planResponse.text()
      throw new Error(`Failed to create plan: ${error}`)
    }
    
    const plan = await planResponse.json()
    console.log('✅ Plan created:', plan.id)
    console.log('   Name:', plan.name)
    console.log('   Status:', plan.status)
    console.log('   Price: $4.99 CAD/month\n')
    
    console.log('🎉 SUCCESS!')
    console.log('\n========================================')
    console.log('PLAN ID (Copy this to Vercel):')
    console.log(plan.id)
    console.log('========================================\n')
    
    const envKey = isSandbox ? 'NEXT_PUBLIC_PAYPAL_PLAN_ID_SANDBOX' : 'NEXT_PUBLIC_PAYPAL_PLAN_ID'
    console.log('Next steps:')
    console.log('1. Copy the Plan ID above')
    console.log('2. Vercel → Project → Settings → Environment Variables')
    console.log('3. Add: ' + envKey + '=' + plan.id)
    if (isSandbox) {
      console.log('   (Sandbox must use this — live Plan IDs return RESOURCE_NOT_FOUND in sandbox.)')
      console.log('   Ensure NEXT_PUBLIC_PAYPAL_MODE=sandbox matches.')
    }
    console.log('4. Redeploy your application')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

createPayPalPlan()
