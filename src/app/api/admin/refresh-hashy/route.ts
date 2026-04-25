import { NextResponse } from 'next/server'

// GitHub configuration
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'your-username'
const GITHUB_REPO = process.env.GITHUB_REPO || 'hashy-tag-databases'
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

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

    // Call the algorithms research endpoint (use relative path for Vercel compatibility)
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
    const algorithmsResponse = await fetch(`${baseUrl}/api/algorithms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!algorithmsResponse.ok) {
      return NextResponse.json({ error: 'Failed to research algorithms' }, { status: 500 })
    }

    const algorithmData = await algorithmsResponse.json()

    // Update Hashy's algorithm configuration
    const hashyUpdate = {
      algorithmInsights: algorithmData.data,
      lastUpdated: algorithmData.lastUpdated,
      provider: algorithmData.provider,
      platforms: Object.keys(algorithmData.data)
    }

    // Save to GitHub if token is available, otherwise save locally
    if (GITHUB_TOKEN) {
      console.log('Saving algorithm insights to GitHub...')
      
      // Get current file SHA from GitHub
      const getFileUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/algorithm-insights.json?ref=${GITHUB_BRANCH}`
      const fileResponse = await fetch(getFileUrl, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })
      
      let fileSha = null
      if (fileResponse.ok) {
        const fileData = await fileResponse.json()
        fileSha = fileData.sha
      }

      // Upload to GitHub
      const content = Buffer.from(JSON.stringify(hashyUpdate, null, 2)).toString('base64')
      const putUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/algorithm-insights.json?ref=${GITHUB_BRANCH}`
      
      const putBody = {
        message: `Update algorithm insights via Hashy refresh - ${new Date().toISOString()}`,
        content: content,
        sha: fileSha
      }

      const putResponse = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putBody)
      })

      if (!putResponse.ok) {
        console.error('Failed to save to GitHub:', await putResponse.text())
        return NextResponse.json({ error: 'Failed to save algorithm insights to GitHub' }, { status: 500 })
      }

      console.log('Successfully saved algorithm insights to GitHub')
    } else {
      console.log('No GitHub token found, saving locally...')
      
      // Fallback to local file system
      const fs = await import('fs/promises')
      const path = await import('path')
      const hashyDir = path.join(process.cwd(), 'lib', 'hashy')
      const algorithmFilePath = path.join(hashyDir, 'algorithm-insights.json')

      await fs.writeFile(algorithmFilePath, JSON.stringify(hashyUpdate, null, 2), 'utf-8')
    }

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
