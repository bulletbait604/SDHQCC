import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    console.log('[DEBUG] Gemini API Key: Request received')
    
    const body = await request.json()
    const { userId, userType } = body

    console.log('[DEBUG] Gemini API Key: User info:', { userId, userType })

    // Validate user authentication
    if (!userId) {
      console.error('[DEBUG] Gemini API Key: User ID required')
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Check subscription
    if (userType !== 'owner' && userType !== 'admin' && userType !== 'lifetime' && userType !== 'subscribed') {
      console.error('[DEBUG] Gemini API Key: Access denied - subscription required')
      return NextResponse.json({ error: 'Access denied. Subscription required.' }, { status: 403 })
    }

    // Get API key from environment
    const apiKey = process.env.GEMINI_API
    
    if (!apiKey) {
      console.error('[DEBUG] Gemini API Key: GEMINI_API not configured')
      return NextResponse.json({ 
        error: 'Service not configured',
        userMessage: 'Gemini API is not configured. Please contact support.',
        details: 'GEMINI_API not configured'
      }, { status: 503 })
    }

    console.log('[DEBUG] Gemini API Key: API key provided successfully', { 
      keyLength: apiKey.length
    })
    
    // Return API key
    return NextResponse.json({
      apiKey: apiKey
    })

  } catch (authError: any) {
    console.error('[DEBUG] Gemini API Key: Error:', authError)
    return NextResponse.json({ 
      error: 'Failed to get API key', 
      details: authError.message 
    }, { status: 503 })
  }
}
