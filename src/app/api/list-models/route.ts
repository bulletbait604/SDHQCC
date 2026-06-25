import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyStaffUser, isProductionDeployment } from '@/lib/auth/staffAccess'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (isProductionDeployment()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    await verifyStaffUser(request)
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const geminiApiKey = process.env.GEMINI_API
    if (!geminiApiKey) {
      return NextResponse.json({ error: 'API not configured' }, { status: 503 })
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: { 'x-goog-api-key': geminiApiKey },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`)
    }

    const data = await response.json()
    const models = data.models || []
    const generateContentModels = models
      .filter((model: { supportedGenerationMethods?: string[] }) =>
        model.supportedGenerationMethods?.includes('generateContent')
      )
      .map((model: { name?: string; displayName?: string; description?: string; supportedGenerationMethods?: string[] }) => ({
        name: model.name || 'Unknown',
        displayName: model.displayName || model.name || 'Unknown',
        description: model.description || 'No description available',
        supportedMethods: model.supportedGenerationMethods || [],
      }))
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))

    return NextResponse.json({
      success: true,
      totalModels: models.length,
      generateContentModels: generateContentModels.length,
      models: generateContentModels,
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: 'Failed to list models', details: message }, { status: 500 })
  }
}
