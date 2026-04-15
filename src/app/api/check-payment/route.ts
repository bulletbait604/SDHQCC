import { NextRequest, NextResponse } from 'next/server'

// Reference to global verified payments from webhook
declare global {
  var verifiedPayments: Map<string, any>
}

// Get PayPal access token
async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  
  console.log('PayPal credentials check:', {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    mode: process.env.PAYPAL_MODE || 'not set'
  })
  
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured')
  }
  
  const isSandbox = process.env.PAYPAL_MODE !== 'live'
  
  const baseUrl = isSandbox 
    ? 'https://api-m.sandbox.paypal.com' 
    : 'https://api-m.paypal.com'
  
  console.log('Using PayPal URL:', baseUrl)
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('PayPal token error:', response.status, errorText)
    throw new Error(`Failed to get access token: ${response.status} - ${errorText}`)
  }
  
  const data = await response.json()
  return data.access_token
}

// Search PayPal transactions by memo
async function searchPayPalTransaction(accessToken: string, paymentCode: string, username: string) {
  const isSandbox = process.env.PAYPAL_MODE !== 'live'
  const baseUrl = isSandbox 
    ? 'https://api-m.sandbox.paypal.com' 
    : 'https://api-m.paypal.com'
  
  // Search transactions from last 30 days
  const endDate = new Date().toISOString()
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  
  // Search by memo field containing the payment code
  const searchUrl = `${baseUrl}/v1/reporting/transactions?start_date=${startDate}&end_date=${endDate}&transaction_status=C&fields=all`
  
  const response = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
  
  if (!response.ok) {
    console.error('PayPal API error:', await response.text())
    return null
  }
  
  const data = await response.json()
  
  // Find transaction with matching memo/custom field
  for (const transaction of data.transaction_details || []) {
    const transactionInfo = transaction.transaction_info
    const payerInfo = transaction.payer_info
    
    // Check if transaction note/memo contains our payment code
    const memo = transactionInfo?.transaction_note || ''
    const customField = transactionInfo?.custom_field || ''
    
    if (memo.includes(paymentCode) || customField.includes(paymentCode)) {
      // Verify payment amount is at least $6.99 CAD
      const amount = parseFloat(transactionInfo?.transaction_amount?.value || '0')
      const currency = transactionInfo?.transaction_amount?.currency_code
      
      if (amount >= 6.99 && currency === 'CAD') {
        return {
          verified: true,
          transactionId: transactionInfo?.transaction_id,
          amount,
          currency,
          payerEmail: payerInfo?.email_address,
          payerName: payerInfo?.payer_name?.given_name + ' ' + payerInfo?.payer_name?.surname,
          timestamp: transactionInfo?.transaction_initiation_date,
        }
      }
    }
  }
  
  return null
}

export async function POST(req: NextRequest) {
  try {
    const { paymentCode, username } = await req.json()
    
    if (!paymentCode || !username) {
      return NextResponse.json(
        { error: 'Missing payment code or username' },
        { status: 400 }
      )
    }
    
    // Check if we have any stored payments from webhook
    if (!global.verifiedPayments) {
      global.verifiedPayments = new Map()
    }
    
    console.log('Checking payment for code:', paymentCode)
    console.log('Stored payments count:', global.verifiedPayments.size)
    console.log('Stored payment codes:', Array.from(global.verifiedPayments.keys()))
    
    // Look for the payment code in stored payments
    const verifiedPayment = global.verifiedPayments.get(paymentCode)
    
    if (verifiedPayment) {
      console.log('Payment found in storage:', verifiedPayment)
      
      // Verify the username matches
      if (verifiedPayment.username !== username) {
        return NextResponse.json({
          verified: false,
          message: 'Payment code does not match username.',
        })
      }
      
      // Check amount is at least $6.99
      if (verifiedPayment.amount < 6.99) {
        return NextResponse.json({
          verified: false,
          message: `Payment amount $${verifiedPayment.amount} is less than required $6.99 CAD.`,
        })
      }
      
      return NextResponse.json({
        verified: true,
        transactionId: verifiedPayment.transactionId,
        amount: verifiedPayment.amount,
        currency: verifiedPayment.currency || 'CAD',
        timestamp: verifiedPayment.verifiedAt,
      })
    }
    
    // Try PayPal API as fallback (for manual verification)
    if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
      try {
        const accessToken = await getPayPalAccessToken()
        const transaction = await searchPayPalTransaction(accessToken, paymentCode, username)
        
        if (transaction) {
          console.log('Payment verified via PayPal API:', transaction)
          return NextResponse.json({
            verified: true,
            transactionId: transaction.transactionId,
            amount: transaction.amount,
            currency: transaction.currency,
            timestamp: transaction.timestamp,
          })
        }
      } catch (paypalError) {
        console.error('PayPal API fallback failed:', paypalError)
        // Continue to return not found message
      }
    }
    
    return NextResponse.json({
      verified: false,
      message: 'Payment not found. Make sure you:\n1. Completed the PayPal payment\n2. Included the code in the PayPal payment note/memo\n3. Wait a moment for PayPal to process (can take 1-2 minutes)',
    })
    
  } catch (error) {
    console.error('Check payment error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to verify payment'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// GET endpoint to check if API is configured
export async function GET() {
  const configured = !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
  
  return NextResponse.json({
    configured,
    mode: process.env.PAYPAL_MODE || 'not set (defaults to sandbox)',
    message: configured 
      ? 'PayPal API is configured' 
      : 'PayPal API not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.',
  })
}
