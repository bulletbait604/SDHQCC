import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAuth,
  hasClipEditorAccess,
  AuthError,
  createAuthErrorResponse,
} from '@/lib/auth/verifyAuth'
import { pickBestVizardVideo, queryVizardProject, vizardCaptionMode, vizardUserMessage } from '@/lib/vizard'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!hasClipEditorAccess(user)) {
      return NextResponse.json({ error: 'Clip Editor requires the Editor badge.' }, { status: 403 })
    }

    const projectId = request.nextUrl.searchParams.get('projectId') || ''
    if (!projectId || projectId.length > 200) {
      return NextResponse.json({ error: 'projectId query parameter is required' }, { status: 400 })
    }

    const data = await queryVizardProject(projectId)
    const bestVideo = pickBestVizardVideo(data.videos)
    return NextResponse.json({
      ...data,
      status: data.code === 1000 ? 'processing' : bestVideo ? 'done' : 'processing',
      videoUrl: bestVideo?.videoUrl || null,
      bestVideo,
      captionMode: vizardCaptionMode(),
      userMessage: data.code === 1000 ? 'Vizard is still editing your clip.' : undefined,
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[clip-editor/vizard/task]', error)
    const message = error instanceof Error ? error.message : 'Vizard status failed'
    return NextResponse.json(
      {
        error: message,
        userMessage: vizardUserMessage({ errMsg: message }),
      },
      { status: 502 }
    )
  }
}
