import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('[DEBUG] List Models: Fetching available models...')
    
    const geminiApiKey = process.env.GEMINI_API
    
    if (!geminiApiKey) {
      console.error('[DEBUG] List Models: GEMINI_API not configured')
      return NextResponse.json({ 
        error: 'API not configured',
        details: 'GEMINI_API not configured'
      }, { status: 503 })
    }

    // Make a direct API call to list models
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: {
        'x-goog-api-key': geminiApiKey
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    const models = data.models || []
    
    console.log(`[DEBUG] List Models: Found ${models.length} models`)
    
    // Filter for generateContent models and sort them
    const generateContentModels = models
      .filter((model: any) => 
        model.supportedGenerationMethods?.includes('generateContent')
      )
      .map((model: any) => ({
        name: model.name || 'Unknown',
        displayName: model.displayName || model.name || 'Unknown',
        description: model.description || 'No description available',
        supportedMethods: model.supportedGenerationMethods || []
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
    
    console.log('[DEBUG] List Models: Successfully listed generateContent models')
    
    return NextResponse.json({
      success: true,
      totalModels: models.length,
      generateContentModels: generateContentModels.length,
      models: generateContentModels,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('[DEBUG] List Models: Error listing models:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to list models',
      details: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
