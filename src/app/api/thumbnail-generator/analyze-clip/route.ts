import { NextRequest, NextResponse } from 'next/server'
import {
  analyzeThumbnailReferenceClip,
  cleanupThumbnailReferenceClip,
} from '@/lib/thumbnailVideoAnalysis'
import {
  thumbnailClipDurationExceededMessage,
  thumbnailClipMaxDurationSeconds,
} from '@/lib/thumbnailClipLimits'
import { verifyAuth, AuthError, createAuthErrorResponse, hasUnlimitedAccess } from '@/lib/auth/verifyAuth'
import { isSafeR2ObjectKey } from '@/lib/r2KeyValidation'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/** Analyze a reference clip and return best-moment metadata (no coin charge — billed on paint). */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)

    const body = await req.json()
    const {
      referenceClipR2Key,
      referenceClipMimeType,
      referenceClipDurationSeconds,
      platforms,
    } = body as {
      referenceClipR2Key?: string
      referenceClipMimeType?: string
      referenceClipDurationSeconds?: number
      platforms?: string[]
    }

    if (typeof referenceClipR2Key !== 'string' || !referenceClipR2Key.trim()) {
      return NextResponse.json({ error: 'Reference clip key is required' }, { status: 400 })
    }

    const clipKey = referenceClipR2Key.trim()
    if (!isSafeR2ObjectKey(clipKey) || !clipKey.startsWith('uploads/thumbnail-clips/')) {
      return NextResponse.json({ error: 'Invalid reference clip key' }, { status: 400 })
    }

    const platformId =
      Array.isArray(platforms) && platforms.length > 0 ? platforms[0]! : 'youtube-shorts'

    const clipMime =
      typeof referenceClipMimeType === 'string' && referenceClipMimeType.length > 0
        ? referenceClipMimeType
        : 'video/mp4'
    const durationSec =
      typeof referenceClipDurationSeconds === 'number' &&
      Number.isFinite(referenceClipDurationSeconds)
        ? referenceClipDurationSeconds
        : undefined

    const maxDurationSec = thumbnailClipMaxDurationSeconds(hasUnlimitedAccess(user))
    if (durationSec != null && durationSec > maxDurationSec) {
      return NextResponse.json(
        { error: thumbnailClipDurationExceededMessage(hasUnlimitedAccess(user)) },
        { status: 400 }
      )
    }

    const analysis = await analyzeThumbnailReferenceClip({
      r2FileKey: clipKey,
      mimeType: clipMime,
      platformId,
      durationSeconds: durationSec,
    })

    await cleanupThumbnailReferenceClip(clipKey).catch(() => undefined)

    return NextResponse.json({ analysis, platformId })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Thumbnail analyze-clip]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
