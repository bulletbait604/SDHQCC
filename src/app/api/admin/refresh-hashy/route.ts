import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyStaffUser, isProductionDeployment } from '@/lib/auth/staffAccess'
import {
  INTERNAL_API_SECRET_HEADER,
  getInternalApiSecret,
} from '@/lib/internalApi'

const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'your-username'
const GITHUB_REPO = process.env.GITHUB_REPO || 'hashy-tag-databases'
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

export async function POST(request: NextRequest) {
  try {
    await verifyStaffUser(request)

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.CLIP_EDITOR_APP_URL || 'http://localhost:3000'
    const secret = getInternalApiSecret()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (secret) {
      headers[INTERNAL_API_SECRET_HEADER] = secret
    }

    const algorithmsResponse = await fetch(`${baseUrl}/api/algorithms`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    })

    if (!algorithmsResponse.ok) {
      return NextResponse.json({ error: 'Failed to research algorithms' }, { status: 500 })
    }

    const algorithmData = await algorithmsResponse.json()

    const hashyUpdate = {
      algorithmInsights: algorithmData.data,
      lastUpdated: algorithmData.lastUpdated,
      provider: algorithmData.provider,
      platforms: Object.keys(algorithmData.data || {}),
    }

    if (GITHUB_TOKEN) {
      const getFileUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/algorithm-insights.json?ref=${GITHUB_BRANCH}`
      const fileResponse = await fetch(getFileUrl, {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })

      let fileSha: string | null = null
      if (fileResponse.ok) {
        const fileData = await fileResponse.json()
        fileSha = fileData.sha
      }

      const content = Buffer.from(JSON.stringify(hashyUpdate, null, 2)).toString('base64')
      const putUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/algorithm-insights.json?ref=${GITHUB_BRANCH}`

      const putResponse = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Update algorithm insights via Hashy refresh - ${new Date().toISOString()}`,
          content,
          sha: fileSha,
        }),
      })

      if (!putResponse.ok) {
        return NextResponse.json({ error: 'Failed to save algorithm insights to GitHub' }, { status: 500 })
      }
    } else if (!isProductionDeployment()) {
      const fs = await import('fs/promises')
      const path = await import('path')
      const hashyDir = path.join(process.cwd(), 'lib', 'hashy')
      const algorithmFilePath = path.join(hashyDir, 'algorithm-insights.json')
      await fs.writeFile(algorithmFilePath, JSON.stringify(hashyUpdate, null, 2), 'utf-8')
    }

    return NextResponse.json({
      success: true,
      message: 'Hashy algorithm refreshed successfully',
      updatedPlatforms: hashyUpdate.platforms,
      lastUpdated: hashyUpdate.lastUpdated,
      provider: hashyUpdate.provider,
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('Error refreshing Hashy algorithm:', error)
    return NextResponse.json({ error: 'Failed to refresh Hashy algorithm' }, { status: 500 })
  }
}
