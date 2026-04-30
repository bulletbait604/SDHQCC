import { NextResponse } from 'next/server'

export async function GET() {
  const modelUsed = 'gemini-3-flash-preview' // This should match our code
  
  console.log('[DEBUG MODEL] Checking model name:', modelUsed)
  console.log('[DEBUG MODEL] Current timestamp:', new Date().toISOString())
  
  return NextResponse.json({
    success: true,
    model: modelUsed,
    message: 'Debug endpoint to verify model deployment',
    timestamp: new Date().toISOString(),
    deploymentHash: 'a08af39'
  })
}
