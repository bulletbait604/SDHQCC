import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export async function GET() {
  try {
    console.log('[DEBUG] Gemini Models: Listing available models...')
    
    const geminiApiKey = process.env.GEMINI_API
    
    if (!geminiApiKey) {
      console.error('[DEBUG] Gemini Models: GEMINI_API not configured')
      return NextResponse.json({ 
        error: 'API not configured',
        details: 'GEMINI_API not configured'
      }, { status: 503 })
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey })
    
    // List available models using the correct API
    console.log('[DEBUG] Gemini Models: Fetching model list...')
    
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
    
    console.log(`[DEBUG] Gemini Models: Found ${models.length} models`)
    
    // Format the response with model details
    const modelList = models.map((model: any) => ({
      name: model.name || 'Unknown',
      displayName: model.displayName || model.name || 'Unknown',
      description: model.description || 'No description available',
      supportedGenerationMethods: model.supportedGenerationMethods || [],
      capabilities: {
        generateContent: model.supportedGenerationMethods?.includes('generateContent') || false,
        streamGenerateContent: model.supportedGenerationMethods?.includes('streamGenerateContent') || false,
        countTokens: model.supportedGenerationMethods?.includes('countTokens') || false,
        embedContent: model.supportedGenerationMethods?.includes('embedContent') || false,
        files: model.supportedGenerationMethods?.includes('files') || false
      }
    }))
    
    // Sort models by name for better readability
    modelList.sort((a: any, b: any) => a.name.localeCompare(b.name))
    
    console.log('[DEBUG] Gemini Models: Successfully listed models')
    
    return NextResponse.json({
      success: true,
      count: modelList.length,
      models: modelList,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('[DEBUG] Gemini Models: Error listing models:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to list models',
      details: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
