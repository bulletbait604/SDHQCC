import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAuth,
  hasClipEditorAccess,
  AuthError,
  createAuthErrorResponse,
} from '@/lib/auth/verifyAuth'
import { clipEditorTwoPassConfigurationHints } from '@/lib/clipEditorServerKeys'
import { generatePresignedReadUrl, putBufferToR2 } from '@/lib/r2'
import { submitVizardClip } from '@/lib/vizard'
import { normalizeHttpMediaUrl } from '@/lib/normalizeMediaUrl'

export const dynamic = 'force-dynamic'

const MAX_REHOST_BYTES = 250 * 1024 * 1024

function isTargetPlatform(value: string): value is 'tiktok' | 'youtube' | 'reels' {
  return value === 'tiktok' || value === 'youtube' || value === 'reels'
}

/** Default true: copy Shotstack output to R2 so Vizard gets a stable HTTPS URL (fixes Vizard 4008). */
function rehostShotstackOutputForVizardEnabled(): boolean {
  const raw = process.env.CLIP_EDITOR_VIZARD_REFINE_REHOST_SHOTSTACK?.trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return true
}

async function rehostHttpVideoToR2PresignedRead(params: {
  sourceUrl: string
  storageUser: string
  fileName: string
  mimeType: string
}): Promise<string | null> {
  const res = await fetch(params.sourceUrl, {
    method: 'GET',
    headers: {
      Accept: 'video/mp4,video/*,*/*',
      'User-Agent': 'SDHQ-Creator-Corner/1.0',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    console.error('[clip-editor/vizard/refine-from-url] Download Shotstack output failed:', res.status)
    return null
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength <= 0 || buf.byteLength > MAX_REHOST_BYTES) {
    console.error('[clip-editor/vizard/refine-from-url] Rehost size invalid:', buf.byteLength)
    return null
  }
  const safeUser = params.storageUser.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 64) || 'user'
  const key = `uploads/clips/${safeUser}/${Date.now()}-shotstack-for-vizard.mp4`
  const wrote = await putBufferToR2(key, buf, params.mimeType || 'video/mp4')
  if (!wrote) return null
  const readUrl = await generatePresignedReadUrl(key, 86400)
  return readUrl
}

/**
 * Start a Vizard project from an existing HTTPS video URL (e.g. completed Shotstack render).
 * Used by the Shotstack → Vizard two-pass pipeline (`CLIP_EDITOR_RENDER_BACKEND=shotstack-then-vizard`).
 *
 * By default re-hosts the video on R2 with a long presigned URL so Vizard can download it (Shotstack CDN URLs are often blocked or short-lived for third parties).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!hasClipEditorAccess(user)) {
      return NextResponse.json({ error: 'Clip Editor requires the Editor badge.' }, { status: 403 })
    }

    const body = (await request.json()) as {
      videoUrl?: string
      platform?: string
      fileName?: string
      mimeType?: string
    }

    const videoUrl = normalizeHttpMediaUrl(body.videoUrl)
    if (!videoUrl) {
      return NextResponse.json({ error: 'videoUrl must be a valid http(s) URL.' }, { status: 400 })
    }
    if (!body.platform || !isTargetPlatform(body.platform)) {
      return NextResponse.json(
        { error: "platform is required and must be one of: 'tiktok' | 'youtube' | 'reels'" },
        { status: 400 }
      )
    }

    const storageUser = user.username.replace(/^@/, '').toLowerCase()
    let sourceForVizard = videoUrl

    if (rehostShotstackOutputForVizardEnabled()) {
      const rehosted = await rehostHttpVideoToR2PresignedRead({
        sourceUrl: videoUrl,
        storageUser,
        fileName: body.fileName || 'shotstack-refine-input.mp4',
        mimeType: body.mimeType || 'video/mp4',
      })
      if (rehosted) {
        sourceForVizard = rehosted
        console.log('[clip-editor/vizard/refine-from-url] Using R2 re-hosted URL for Vizard ingest.')
      } else {
        console.warn(
          '[clip-editor/vizard/refine-from-url] R2 re-host failed; sending original URL to Vizard (may fail with 4008). Check R2 env vars and file size.'
        )
      }
    }

    const vizard = await submitVizardClip({
      sourceUrl: sourceForVizard,
      platform: body.platform,
      fileName: body.fileName || 'shotstack-refine-input.mp4',
      mimeType: body.mimeType || 'video/mp4',
      projectName: `SDHQ ${body.platform} Vizard refine (after Shotstack)`,
    })

    return NextResponse.json({
      vizard: {
        projectId: String(vizard.projectId),
        shareLink: vizard.shareLink || null,
      },
      rehostedForVizard: sourceForVizard !== videoUrl,
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[clip-editor/vizard/refine-from-url]', error)
    const message = error instanceof Error ? error.message : 'Could not start Vizard refine'
    return NextResponse.json(
      {
        error: message,
        userMessage: message,
        configurationHints: clipEditorTwoPassConfigurationHints(),
      },
      { status: 500 }
    )
  }
}
