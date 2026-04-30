import { NextResponse } from 'next/server'

// Force dynamic rendering to prevent static optimization
export const dynamic = 'force-dynamic'

export async function GET() {
  const modelUsed = 'gemini-2.5-flash'
  
  console.log('[DEBUG MODEL] Checking model name:', modelUsed)
  console.log('[DEBUG MODEL] Current timestamp:', new Date().toISOString())
  
  const response = NextResponse.json({
    success: true,
    model: modelUsed,
    message: 'Debug endpoint to verify model deployment',
    timestamp: new Date().toISOString(),
    deploymentHash: '2e2e9ae'
  })
  
  // Add cache-busting headers
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  response.headers.set('X-Deploy-Hash', '2e2e9ae')
  
  return response
}
