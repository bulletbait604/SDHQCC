import { NextResponse } from 'next/server'

// Admin-only endpoint to refresh Hashy's algorithm
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { isAdmin = false } = body

    // Verify admin access
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    console.log('Admin requested Hashy algorithm refresh...')

    // Call the algorithms research endpoint
    const algorithmsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/algorithms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!algorithmsResponse.ok) {
      return NextResponse.json({ error: 'Failed to research algorithms' }, { status: 500 })
    }

    const algorithmData = await algorithmsResponse.json()

    // Update Hashy's algorithm configuration
    // This will be used to adjust tag generation based on current platform algorithms
    const hashyUpdate = {
      algorithmInsights: algorithmData.data,
      lastUpdated: algorithmData.lastUpdated,
      provider: algorithmData.provider,
      platforms: Object.keys(algorithmData.data)
    }

    // Save the updated algorithm data for Hashy to use
    const fs = await import('fs/promises')
    const path = await import('path')
    const hashyDir = path.join(process.cwd(), 'lib', 'hashy')
    const algorithmFilePath = path.join(hashyDir, 'algorithm-insights.json')

    await fs.writeFile(algorithmFilePath, JSON.stringify(hashyUpdate, null, 2), 'utf-8')

    console.log('Hashy algorithm refreshed successfully')
    console.log(`Updated ${hashyUpdate.platforms.length} platforms`)

    return NextResponse.json({
      success: true,
      message: 'Hashy algorithm refreshed successfully',
      updatedPlatforms: hashyUpdate.platforms,
      lastUpdated: hashyUpdate.lastUpdated,
      provider: hashyUpdate.provider
    })

  } catch (error) {
    console.error('Error refreshing Hashy algorithm:', error)
    return NextResponse.json({ error: 'Failed to refresh Hashy algorithm' }, { status: 500 })
  }
}
