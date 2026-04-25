import { NextRequest, NextResponse } from 'next/server'

// Reference to global verified payments from webhook
declare global {
  var verifiedPayments: Map<string, any>
}

// Get PayPal access token
async function getPayPalAccessToken(): Promise<string | null> {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    console.error('PayPal credentials not configured')
    return null
  }
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  
  try {
    const paypalUrl = process.env.NODE_ENV === 'production'
      ? 'https://api-m.paypal.com/v1/oauth2/token'
      : 'https://api-m.sandbox.paypal.com/v1/oauth2/token'
    
    const response = await fetch(paypalUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    
    if (!response.ok) {
      console.error('PayPal token request failed:', response.status)
      return null
    }
    
    const data = await response.json()
    return data.access_token
  } catch (error) {
    console.error('Error getting PayPal access token:', error)
    return null
  }
}

// Search PayPal transactions for a specific note/memo
async function searchPayPalTransactions(accessToken: string, paymentCode: string): Promise<any | null> {
  try {
    const paypalUrl = process.env.NODE_ENV === 'production'
      ? 'https://api-m.paypal.com/v1/reporting/transactions'
      : 'https://api-m.sandbox.paypal.com/v1/reporting/transactions'
    
    // Search for transactions from the last 7 days
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 7)
    
    const params = new URLSearchParams({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      fields: 'all',
    })
    
    const response = await fetch(`${paypalUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      console.error('PayPal transaction search failed:', response.status)
      return null
    }
    
    const data = await response.json()
    console.log('PayPal transactions retrieved:', data.transaction_details?.length || 0)
    
    // Search for transactions with the payment code in note or memo
    if (data.transaction_details) {
      for (const transaction of data.transaction_details) {
        const note = transaction.transaction_info.note || ''
        const memo = transaction.transaction_info.memo || ''
        const customField = transaction.transaction_info.custom_field || ''
        
        // Check if payment code is in any of these fields
        if (note.includes(paymentCode) || memo.includes(paymentCode) || customField.includes(paymentCode)) {
          console.log('Found matching transaction:', transaction.transaction_info.transaction_id)
          
          // Verify payment status and amount
          const status = transaction.transaction_info.transaction_status
          const amount = parseFloat(transaction.transaction_info.transaction_amount.value)
          const currency = transaction.transaction_info.transaction_amount.currency_code
          
          if (status === 'S' || status === 'C') { // S = Success, C = Completed
            return {
              transactionId: transaction.transaction_info.transaction_id,
              amount,
              currency,
              status,
              note,
              memo,
              customField,
              transactionDate: transaction.transaction_info.transaction_initiation_date,
            }
          }
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('Error searching PayPal transactions:', error)
    return null
  }
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
    
    console.log('Checking payment for code:', paymentCode, 'username:', username)
    
    // First, check webhook storage (for backwards compatibility)
    if (!global.verifiedPayments) {
      global.verifiedPayments = new Map()
    }
    
    const webhookPayment = global.verifiedPayments.get(paymentCode)
    
    if (webhookPayment) {
      console.log('Payment found in webhook storage:', webhookPayment)
      
      if (webhookPayment.username !== username) {
        return NextResponse.json({
          verified: false,
          message: 'Payment code does not match username.',
        })
      }
      
      if (webhookPayment.amount < 6.99) {
        return NextResponse.json({
          verified: false,
          message: `Payment amount $${webhookPayment.amount} is less than required $6.99 CAD.`,
        })
      }
      
      return NextResponse.json({
        verified: true,
        transactionId: webhookPayment.transactionId,
        amount: webhookPayment.amount,
        currency: webhookPayment.currency || 'CAD',
        timestamp: webhookPayment.verifiedAt,
        source: 'webhook',
      })
    }
    
    // If not found in webhook storage, actively query PayPal API
    console.log('Payment not in webhook storage, querying PayPal API...')
    
    const accessToken = await getPayPalAccessToken()
    
    if (!accessToken) {
      return NextResponse.json({
        verified: false,
        message: 'PayPal API authentication failed. Please contact support.',
      })
    }
    
    const paypalTransaction = await searchPayPalTransactions(accessToken, paymentCode)
    
    if (paypalTransaction) {
      console.log('Found transaction via PayPal API:', paypalTransaction)
      
      // Verify amount is at least $6.99
      if (paypalTransaction.amount < 6.99) {
        return NextResponse.json({
          verified: false,
          message: `Payment amount $${paypalTransaction.amount} is less than required $6.99.`,
        })
      }
      
      // Extract username from payment code to verify
      const codeMatch = paymentCode.match(/SDHQ-([A-Za-z0-9_]+)-/)
      if (codeMatch) {
        const codeUsername = codeMatch[1]
        if (codeUsername.toLowerCase() !== username.toLowerCase()) {
          return NextResponse.json({
            verified: false,
            message: 'Payment code does not match your username.',
          })
        }
      }
      
      // Store in webhook storage for future reference
      global.verifiedPayments.set(paymentCode, {
        username,
        amount: paypalTransaction.amount,
        transactionId: paypalTransaction.transactionId,
        verifiedAt: new Date().toISOString(),
        paymentStatus: 'Completed',
        verificationCode: paymentCode,
        currency: paypalTransaction.currency,
      })
      
      return NextResponse.json({
        verified: true,
        transactionId: paypalTransaction.transactionId,
        amount: paypalTransaction.amount,
        currency: paypalTransaction.currency,
        timestamp: paypalTransaction.transactionDate,
        source: 'api',
      })
    }
    
    console.log('No matching transaction found')
    
    return NextResponse.json({
      verified: false,
      message: 'Payment not found. Make sure you:\n1. Completed the PayPal payment\n2. Included the code in the PayPal payment note/memo\n3. The payment was successful (at least $6.99)\n4. Wait a moment for PayPal to process (can take 1-2 minutes)',
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

// GET endpoint for debugging - shows stored payments
export async function GET() {
  // Initialize if not exists
  if (!global.verifiedPayments) {
    global.verifiedPayments = new Map()
  }
  
  // Convert Map to array for JSON response
  const payments = Array.from(global.verifiedPayments.entries()).map(([code, payment]) => ({
    code,
    ...payment
  }))
  
  return NextResponse.json({
    system: 'Webhook-based verification only',
    totalPayments: global.verifiedPayments.size,
    storedPayments: payments,
    message: 'Payments are stored when PayPal webhook is received',
    setup: 'Configure webhook at https://developer.paypal.com/dashboard/applications',
    webhookUrl: 'https://sdhqcc.vercel.app/api/paypal-webhook'
  })
}
