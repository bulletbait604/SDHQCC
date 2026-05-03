import { NextRequest, NextResponse } from 'next/server'
import { GoogleAuth } from 'google-auth-library'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import type { UserRole } from '@/lib/auth/verifyAuth'

const PAID_GEMINI_TOKEN_ROLES: UserRole[] = [
  'owner',
  'admin',
  'subscriber',
  'subscriber_lifetime',
  'tester',
]

/**
 * Service-account OAuth token — subscriber tiers and staff only.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)

    if (!PAID_GEMINI_TOKEN_ROLES.includes(user.role)) {
      return NextResponse.json(
        { error: 'Access denied. Subscription or staff role required.' },
        { status: 403 }
      )
    }

    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

    if (!serviceAccountKey) {
      console.error('[Gemini Token] GOOGLE_SERVICE_ACCOUNT_KEY not configured')
      return NextResponse.json(
        {
          error: 'Service not configured',
          userMessage: 'Gemini authentication is not configured. Please contact support.',
          details: 'GOOGLE_SERVICE_ACCOUNT_KEY not configured',
        },
        { status: 503 }
      )
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountKey)

      const auth = new GoogleAuth({
        credentials: serviceAccount,
        scopes: [
          'https://www.googleapis.com/auth/generative-language',
          'https://www.googleapis.com/auth/cloud-platform',
          'https://www.googleapis.com/auth/devstorage.read_write',
        ],
      })

      const client = await auth.getClient()
      const accessToken = await client.getAccessToken()

      if (!accessToken?.token) {
        throw new Error('Failed to generate access token')
      }

      return NextResponse.json({
        accessToken: accessToken.token,
        serviceAccountEmail: serviceAccount.client_email,
        expiresIn: 3600,
        tokenType: 'Bearer',
      })
    } catch (authError: unknown) {
      console.error('[Gemini Token] Authentication error:', authError)
      const msg = authError instanceof Error ? authError.message : 'Authentication failed'
      return NextResponse.json(
        {
          error: 'Authentication failed',
          userMessage: 'Gemini authentication failed. Please contact support.',
          details: msg,
        },
        { status: 503 }
      )
    }
  } catch (e: unknown) {
    if (e instanceof AuthError) return createAuthErrorResponse(e)
    console.error('[Gemini Token]', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
