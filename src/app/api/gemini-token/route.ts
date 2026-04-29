import { NextResponse } from 'next/server'
import { GoogleAuth } from 'google-auth-library'

export async function POST(request: Request) {
  try {
    console.log('[DEBUG] Gemini Token: Request received')
    
    const body = await request.json()
    const { userId, userType } = body

    console.log('[DEBUG] Gemini Token: User info:', { userId, userType })

    // Validate user authentication
    if (!userId) {
      console.error('[DEBUG] Gemini Token: User ID required')
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Check subscription
    if (userType !== 'owner' && userType !== 'admin' && userType !== 'lifetime' && userType !== 'subscribed') {
      console.error('[DEBUG] Gemini Token: Access denied - subscription required')
      return NextResponse.json({ error: 'Access denied. Subscription required.' }, { status: 403 })
    }

    // Get Service Account credentials from environment
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    
    if (!serviceAccountKey) {
      console.error('[DEBUG] Gemini Token: GOOGLE_SERVICE_ACCOUNT_KEY not configured')
      return NextResponse.json({ 
        error: 'Service not configured',
        userMessage: 'Gemini authentication is not configured. Please contact support.',
        details: 'GOOGLE_SERVICE_ACCOUNT_KEY not configured'
      }, { status: 503 })
    }

    try {
      // Parse the service account key
      const serviceAccount = JSON.parse(serviceAccountKey)
      
      console.log('[DEBUG] Gemini Token: Service account parsed:', { 
        project_id: serviceAccount.project_id,
        client_email: serviceAccount.client_email 
      })
      
      // Create GoogleAuth client
      const auth = new GoogleAuth({
        credentials: serviceAccount,
        scopes: ['https://www.googleapis.com/auth/generative-language']
      })

      console.log('[DEBUG] Gemini Token: Requesting access token with scope: https://www.googleapis.com/auth/generative-language')

      // Get access token
      const client = await auth.getClient()
      const accessToken = await client.getAccessToken()

      if (!accessToken || !accessToken.token) {
        throw new Error('Failed to generate access token')
      }

      console.log('[DEBUG] Gemini Token: Access token generated successfully', { 
        tokenLength: accessToken.token.length,
        expiresIn: 3600 
      })
      
      // Return token with expiry info (tokens typically expire in 1 hour)
      return NextResponse.json({
        accessToken: accessToken.token,
        expiresIn: 3600, // 1 hour in seconds
        tokenType: 'Bearer'
      })

    } catch (authError: any) {
      console.error('[DEBUG] Gemini Token: Authentication error:', authError)
      
      if (authError.message?.includes('invalid_grant')) {
        console.log('[ACTIVITY_LOG] Gemini Token: Invalid service account credentials')
      } else if (authError.message?.includes('permission')) {
        console.log('[ACTIVITY_LOG] Gemini Token: Insufficient permissions on service account')
      } else {
        console.log(`[ACTIVITY_LOG] Gemini Token: Gemini API error - ${authError.message || 'Unknown error'}`)
      }
      
      return NextResponse.json({ 
        error: 'Authentication failed',
        userMessage: 'Gemini authentication failed. Please contact support.',
        details: authError.message
      }, { status: 503 })
    }

  } catch (error) {
    console.error('[DEBUG] Gemini Token: Unhandled error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
