import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory storage for verified payments (resets on deploy)
// In production, use Redis, database, or Vercel KV
declare global {
  var verifiedPayments: Map<string, any>
  var verifiedUsers: Map<string, any>
}

if (!global.verifiedPayments) {
  global.verifiedPayments = new Map()
}

if (!global.verifiedUsers) {
  global.verifiedUsers = new Map()
}

// PayPal IPN verification endpoint (for one-time payments, backward compatibility)
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const params = new URLSearchParams(body)
    
    // Log the IPN data for debugging
    const ipnData: Record<string, string> = {}
    params.forEach((value, key) => {
      ipnData[key] = value
    })
    
    console.log('========================================')
    console.log('WEBHOOK RECEIVED at', new Date().toISOString())
    console.log('========================================')
    console.log('PayPal IPN Data:', JSON.stringify(ipnData, null, 2))
    console.log('Payment Status:', ipnData.payment_status)
    console.log('Transaction ID:', ipnData.txn_id)
    console.log('Custom/Memo:', ipnData.custom || ipnData.memo)
    console.log('Amount:', ipnData.mc_gross, ipnData.mc_currency)
    
    // Check if this is a subscription webhook (JSON format)
    const contentType = req.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      // Handle PayPal subscription webhook events
      try {
        const eventData = JSON.parse(body)
        console.log('PayPal Webhook Event:', JSON.stringify(eventData, null, 2))
        
        const eventType = eventData.event_type
        console.log('Event Type:', eventType)
        
        // Handle subscription activation
        if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED' || eventType === 'BILLING.SUBSCRIPTION.CREATED') {
          const subscriptionId = eventData.resource?.id
          const customId = eventData.resource?.custom_id
          
          console.log('Subscription Activated:', subscriptionId)
          console.log('Custom ID:', customId)
          
          if (customId) {
            const [username, paypalEmail] = customId.split('|')
            
            if (username) {
              // Store verified user
              const verifiedUser = {
                username,
                paypalEmail,
                subscriptionId,
                verifiedAt: new Date().toISOString(),
                status: 'ACTIVE'
              }
              
              global.verifiedUsers.set(username.toLowerCase(), verifiedUser)
              
              console.log('✅ User automatically verified:', username)
              console.log('Total verified users:', global.verifiedUsers.size)
              
              return NextResponse.json({ status: 'success', username, autoVerified: true })
            }
          }
        }
        
        return NextResponse.json({ status: 'received', eventType })
      } catch (jsonError) {
        console.error('Error parsing webhook JSON:', jsonError)
      }
    }
    
    // Verify IPN with PayPal (backward compatibility for one-time payments)
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
      console.log('✅ PAYMENT VERIFIED BY PAYPAL')
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
          
          // Store verified payment in global Map
          const verifiedPayment = {
            username,
            amount,
            transactionId: ipnData.txn_id,
            verifiedAt: new Date().toISOString(),
            paymentStatus,
            verificationCode,
            currency: ipnData.mc_currency || 'CAD'
          }
          
          // Store by verification code for lookup
          global.verifiedPayments.set(verificationCode, verifiedPayment)
          
          console.log('Payment verified and stored for user:', username, verifiedPayment)
          console.log('Total stored payments:', global.verifiedPayments.size)
          
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

// Handle GET for testing and checking verification status
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')
  
  if (username) {
    // Check if user is verified
    const verifiedUser = global.verifiedUsers.get(username.toLowerCase())
    if (verifiedUser) {
      return NextResponse.json({ 
        verified: true,
        username: verifiedUser.username,
        subscriptionId: verifiedUser.subscriptionId,
        verifiedAt: verifiedUser.verifiedAt,
        status: verifiedUser.status
      })
    }
    
    return NextResponse.json({ verified: false })
  }
  
  return NextResponse.json({ 
    message: 'PayPal webhook endpoint active',
    setup: 'Configure this URL in your PayPal webhook settings',
    url: 'https://sdhqcc.vercel.app/api/paypal-webhook',
    verifiedUsers: Array.from(global.verifiedUsers.values()),
    verifiedPayments: Array.from(global.verifiedPayments.values())
  })
}
