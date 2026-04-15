import { NextRequest, NextResponse } from 'next/server'

// Reference to global verified payments from webhook
declare global {
  var verifiedPayments: Map<string, any>
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
    
    console.log('Payment not found in webhook storage')
    
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
