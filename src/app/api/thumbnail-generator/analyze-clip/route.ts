import { NextRequest, NextResponse } from 'next/server'
import {
  analyzeThumbnailClipFromFrames,
  analyzeThumbnailReferenceClip,
  cleanupThumbnailReferenceClip,
  type ThumbnailSampleFrame,
} from '@/lib/thumbnailVideoAnalysis'
import {
  thumbnailClipDurationExceededMessage,
  thumbnailClipMaxDurationSeconds,
} from '@/lib/thumbnailClipLimits'
import { verifyAuth, AuthError, createAuthErrorResponse, hasUnlimitedAccess } from '@/lib/auth/verifyAuth'
import { isSafeR2ObjectKey } from '@/lib/r2KeyValidation'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const MAX_SAMPLE_FRAMES = 12
const MAX_FRAME_B64_CHARS = 400_000

function parseSampleFrames(raw: unknown): ThumbnailSampleFrame[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  if (raw.length > MAX_SAMPLE_FRAMES) {
    throw new Error('Too many sample frames')
  }
  const frames: ThumbnailSampleFrame[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const timestampSeconds =
      typeof rec.timestampSeconds === 'number'
        ? rec.timestampSeconds
        : typeof rec.timeSec === 'number'
          ? rec.timeSec
          : NaN
    const imageBase64 = typeof rec.imageBase64 === 'string' ? rec.imageBase64 : ''
    if (!Number.isFinite(timestampSeconds) || timestampSeconds < 0 || !imageBase64) continue
    if (imageBase64.length > MAX_FRAME_B64_CHARS) {
      throw new Error('A sample frame is too large')
    }
    frames.push({
      timestampSeconds,
      imageBase64,
      mimeType: typeof rec.mimeType === 'string' ? rec.mimeType : 'image/jpeg',
    })
  }
  return frames.length > 0 ? frames : null
}

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
      sampleFrames: sampleFramesRaw,
    } = body as {
      referenceClipR2Key?: string
      referenceClipMimeType?: string
      referenceClipDurationSeconds?: number
      platforms?: string[]
      sampleFrames?: unknown
    }

    const platformId =
      Array.isArray(platforms) && platforms.length > 0 ? platforms[0]! : 'youtube-shorts'

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

    let sampleFrames: ThumbnailSampleFrame[] | null = null
    try {
      sampleFrames = parseSampleFrames(sampleFramesRaw)
    } catch (parseErr) {
      const message = parseErr instanceof Error ? parseErr.message : 'Invalid sample frames'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    if (sampleFrames) {
      const analysis = await analyzeThumbnailClipFromFrames({
        frames: sampleFrames,
        platformId,
        durationSeconds: durationSec,
      })
      return NextResponse.json({ analysis, platformId, mode: 'frames' })
    }

    if (typeof referenceClipR2Key !== 'string' || !referenceClipR2Key.trim()) {
      return NextResponse.json({ error: 'Reference clip key is required' }, { status: 400 })
    }

    const clipKey = referenceClipR2Key.trim()
    if (!isSafeR2ObjectKey(clipKey) || !clipKey.startsWith('uploads/thumbnail-clips/')) {
      return NextResponse.json({ error: 'Invalid reference clip key' }, { status: 400 })
    }

    const clipMime =
      typeof referenceClipMimeType === 'string' && referenceClipMimeType.length > 0
        ? referenceClipMimeType
        : 'video/mp4'

    const analysis = await analyzeThumbnailReferenceClip({
      r2FileKey: clipKey,
      mimeType: clipMime,
      platformId,
      durationSeconds: durationSec,
    })

    await cleanupThumbnailReferenceClip(clipKey).catch(() => undefined)

    return NextResponse.json({ analysis, platformId, mode: 'video' })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Thumbnail analyze-clip]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
