import { NextRequest, NextResponse } from 'next/server'

// PayPal IPN verification endpoint
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const params = new URLSearchParams(body)
    
    // Log the IPN data for debugging
    const ipnData: Record<string, string> = {}
    params.forEach((value, key) => {
      ipnData[key] = value
    })
    
    console.log('PayPal IPN Received:', ipnData)
    
    // Verify IPN with PayPal
    const verificationParams = new URLSearchParams()
    verificationParams.append('cmd', '_notify-validate')
    
    params.forEach((value, key) => {
      verificationParams.append(key, value)
    })
    
    // Use PayPal's sandbox or live verification URL
    const paypalUrl = process.env.NODE_ENV === 'production' 
      ? 'https://ipnpb.paypal.com/cgi-bin/webscr'
      : 'https://ipnpb.sandbox.paypal.com/cgi-bin/webscr'
    
    const verificationResponse = await fetch(paypalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: verificationParams.toString(),
    })
    
    const verificationStatus = await verificationResponse.text()
    
    console.log('PayPal Verification Status:', verificationStatus)
    
    if (verificationStatus === 'VERIFIED') {
      // Payment is verified
      const paymentStatus = ipnData.payment_status
      const txnType = ipnData.txn_type
      const customField = ipnData.custom || ipnData.item_name || ''
      const memo = ipnData.memo || ''
      
      // Check if payment is completed
      if (paymentStatus === 'Completed' || paymentStatus === 'Pending') {
        // Look for our verification code in custom field or memo
        const verificationCode = customField || memo
        
        // Extract username from code (format: SDHQ-USERNAME-RANDOM)
        const match = verificationCode.match(/SDHQ-([A-Za-z0-9_]+)-/)
        
        if (match) {
          const username = match[1]
          const amount = parseFloat(ipnData.mc_gross || '0')
          
          // Store verified payment (in production, use a database)
          const verifiedPayment = {
            username,
            amount,
            transactionId: ipnData.txn_id,
            verifiedAt: new Date().toISOString(),
            paymentStatus,
            verificationCode
          }
          
          // In production, save to database
          // For now, we'll store in a JSON file or memory
          console.log('Payment verified for user:', username, verifiedPayment)
          
          // Return success to PayPal
          return NextResponse.json({ status: 'success', username, amount })
        }
      }
    }
    
    return NextResponse.json({ status: 'received' })
    
  } catch (error) {
    console.error('PayPal webhook error:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}

// Handle GET for testing
export async function GET() {
  return NextResponse.json({ 
    message: 'PayPal IPN endpoint active',
    setup: 'Configure this URL in your PayPal account under IPN settings',
    url: 'https://sdhqcc.vercel.app/api/paypal-webhook'
  })
}
