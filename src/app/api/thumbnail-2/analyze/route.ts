import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse, hasUnlimitedAccess } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { isSafeR2ObjectKey } from '@/lib/r2KeyValidation'
import { getR2ObjectMetadata } from '@/lib/r2'
import {
  analyzeThumbnail2Clip,
  cleanupThumbnail2Clip,
} from '@/lib/thumbnail2Pipeline'
import {
  thumbnail2ClipDurationExceededMessage,
  thumbnail2ClipMaxBytes,
  thumbnail2ClipMaxDurationSeconds,
} from '@/lib/thumbnail2Limits'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Owner-only: analyze long clip for best viral frame (R2 deleted after). */
export async function POST(req: NextRequest) {
  let clipKey = ''
  try {
    const user = await verifyOwnerUser(req)
    const unlimited = hasUnlimitedAccess(user)

    const body = await req.json()
    const {
      r2FileKey,
      mimeType,
      durationSeconds,
      platformId,
    } = body as {
      r2FileKey?: string
      mimeType?: string
      durationSeconds?: number
      platformId?: string
    }

    if (typeof r2FileKey !== 'string' || !r2FileKey.trim()) {
      return NextResponse.json({ error: 'Clip upload is required' }, { status: 400 })
    }

    clipKey = r2FileKey.trim()
    const storageUser = user.username.replace(/^@/, '').toLowerCase()
    const prefix = `uploads/thumbnail2-clips/${storageUser}/`
    if (!isSafeR2ObjectKey(clipKey) || !clipKey.startsWith(prefix)) {
      return NextResponse.json({ error: 'Invalid clip file key' }, { status: 400 })
    }

    const platform = typeof platformId === 'string' && platformId.trim() ? platformId.trim() : 'youtube-shorts'
    const durationSec =
      typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)
        ? durationSeconds
        : undefined

    const maxDur = thumbnail2ClipMaxDurationSeconds(unlimited)
    if (durationSec != null && durationSec > maxDur) {
      return NextResponse.json(
        { error: thumbnail2ClipDurationExceededMessage(unlimited) },
        { status: 400 }
      )
    }

    const meta = await getR2ObjectMetadata(clipKey)
    if (!meta) {
      return NextResponse.json({ error: 'Clip not found in storage' }, { status: 404 })
    }
    const maxBytes = thumbnail2ClipMaxBytes(unlimited)
    if (meta.contentLength > maxBytes) {
      return NextResponse.json({ error: 'Clip file is too large' }, { status: 400 })
    }

    const analysis = await analyzeThumbnail2Clip({
      r2FileKey: clipKey,
      mimeType: typeof mimeType === 'string' && mimeType ? mimeType : 'video/mp4',
      platformId: platform,
      durationSeconds: durationSec,
    })

    return NextResponse.json({
      analysis,
      platformId: platform,
      videoModel:
        process.env.THUMBNAIL2_VIDEO_MODEL?.trim() || 'gemini-3.1-flash-lite',
    })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[Thumbnail2 analyze]', err)
    const message = err instanceof Error ? err.message : 'Analyze failed'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    if (clipKey) {
      await cleanupThumbnail2Clip(clipKey).catch(() => undefined)
    }
  }
}
