import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, hasUnlimitedAccess, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { resolveCoinBalanceUserId } from '@/lib/coinUserId'
import { spendToolCoins } from '@/lib/coins/spendToolCoins'
import { toolCoinCost } from '@/lib/coins/toolCosts'
import { deleteFileFromR2, getR2ObjectMetadata } from '@/lib/r2'
import { isSafeR2ObjectKey } from '@/lib/r2KeyValidation'
import { DEFAULT_PLATFORMS } from '@/lib/home/defaultPlatforms'
import { POST4ME_ANALYZE_CHUNK_SECONDS, POST4ME_CLIP_MAX_BYTES } from '@/lib/post4meLimits'
import {
  generatePost4MeFromClip,
  generatePost4MeFromFrames,
  estimatePost4MeUsd,
  type Post4MeSampleFrame,
} from '@/lib/post4meGenerate'
import {
  buildPost4MePlatformOutputs,
  normalizePost4MePlatformIds,
} from '@/lib/post4meFormat'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const POST4ME_COIN_COST = toolCoinCost('post4me') ?? 2
const MAX_SAMPLE_FRAMES = 16
const MAX_FRAME_B64_CHARS = 400_000

function parsePost4MeSampleFrames(raw: unknown): Post4MeSampleFrame[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  if (raw.length > MAX_SAMPLE_FRAMES) {
    throw new Error('Too many sample frames')
  }
  const frames: Post4MeSampleFrame[] = []
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

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    const body = await request.json()
    const {
      r2FileKey,
      mimeType,
      fileName,
      fileSize,
      durationSeconds,
      platform,
      platforms,
      prompt,
      sampleFrames: sampleFramesRaw,
      chunkStartSeconds,
      chunkDurationSeconds,
      sourceDurationSeconds,
    } = body as {
      r2FileKey?: string
      mimeType?: string
      fileName?: string
      fileSize?: number
      durationSeconds?: number
      platform?: string
      platforms?: string[]
      prompt?: string
      sampleFrames?: unknown
      chunkStartSeconds?: number
      chunkDurationSeconds?: number
      sourceDurationSeconds?: number
    }

    const platformIds = normalizePost4MePlatformIds(
      platforms ?? (platform ? [platform] : [])
    )
    if (platformIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one platform' }, { status: 400 })
    }

    let sampleFrames: Post4MeSampleFrame[] | null = null
    try {
      sampleFrames = parsePost4MeSampleFrames(sampleFramesRaw)
    } catch (parseErr) {
      const message = parseErr instanceof Error ? parseErr.message : 'Invalid sample frames'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const clipKey = typeof r2FileKey === 'string' ? r2FileKey.trim() : ''
    if (!sampleFrames && !clipKey) {
      return NextResponse.json({ error: 'Clip upload is required' }, { status: 400 })
    }

    if (!hasUnlimitedAccess(user)) {
      if (user.role !== 'free') {
        return NextResponse.json({ error: 'Access denied. Subscription required.' }, { status: 403 })
      }
      const client = await clientPromise
      const db = client.db('sdhq')
      const balanceKey = await resolveCoinBalanceUserId(db, user)
      const row = await db.collection('coinBalances').findOne({ userId: balanceKey })
      const coins = typeof row?.coins === 'number' ? row.coins : 0
      if (coins < POST4ME_COIN_COST) {
        return NextResponse.json(
          {
            error: 'Not enough coins',
            userMessage: `Post4Me needs at least ${POST4ME_COIN_COST} coins. Purchase coins or upgrade for unlimited access.`,
          },
          { status: 403 }
        )
      }
    }

    const userPrompt = typeof prompt === 'string' ? prompt : ''
    const chunkDur =
      typeof chunkDurationSeconds === 'number' && Number.isFinite(chunkDurationSeconds)
        ? chunkDurationSeconds
        : typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)
          ? Math.min(durationSeconds, POST4ME_ANALYZE_CHUNK_SECONDS)
          : POST4ME_ANALYZE_CHUNK_SECONDS
    const sourceDur =
      typeof sourceDurationSeconds === 'number' && Number.isFinite(sourceDurationSeconds)
        ? sourceDurationSeconds
        : typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)
          ? durationSeconds
          : undefined
    const chunkStart =
      typeof chunkStartSeconds === 'number' && Number.isFinite(chunkStartSeconds)
        ? chunkStartSeconds
        : 0

    let generated
    if (sampleFrames) {
      generated = await generatePost4MeFromFrames({
        frames: sampleFrames,
        platformIds,
        userPrompt,
        chunkStartSeconds: chunkStart,
        chunkDurationSeconds: chunkDur,
        sourceDurationSeconds: sourceDur,
        platforms: DEFAULT_PLATFORMS,
      })
    } else {
      const storageUser = user.username.replace(/^@/, '').toLowerCase()
      const prefix = `uploads/post4me-clips/${storageUser}/`
      if (!isSafeR2ObjectKey(clipKey) || !clipKey.startsWith(prefix) || clipKey.includes('..')) {
        return NextResponse.json({ error: 'Invalid clip file key' }, { status: 400 })
      }

      const meta = await getR2ObjectMetadata(clipKey)
      if (!meta) {
        return NextResponse.json(
          {
            error: 'Clip not found',
            userMessage: 'Could not load your upload. Try uploading again.',
          },
          { status: 404 }
        )
      }
      if (meta.contentLength > POST4ME_CLIP_MAX_BYTES) {
        return NextResponse.json({ error: 'File too large' }, { status: 400 })
      }

      try {
        generated = await generatePost4MeFromClip({
          r2FileKey: clipKey,
          mimeType: mimeType || meta.contentType || 'video/mp4',
          platformIds,
          userPrompt,
          durationSeconds: chunkDur,
          platforms: DEFAULT_PLATFORMS,
        })
      } finally {
        await deleteFileFromR2(clipKey).catch(() => undefined)
      }
    }

    if (!hasUnlimitedAccess(user)) {
      const spend = await spendToolCoins(user, 'post4me')
      if (!spend.ok) {
        return NextResponse.json(
          { error: spend.reason, required: spend.required, available: spend.available },
          { status: spend.status }
        )
      }
    }

    const estimate = estimatePost4MeUsd(chunkDur)
    const results = buildPost4MePlatformOutputs(generated)

    return NextResponse.json({
      platforms: platformIds,
      results,
      fileName: typeof fileName === 'string' ? fileName : undefined,
      fileSize: typeof fileSize === 'number' ? fileSize : undefined,
      estimatedCostUsd: estimate.estimatedCostUsd,
      estimatedCostNote: estimate.estimatedCostNote,
    })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[Post4Me]', err)
    const message = err instanceof Error ? err.message : 'Post4Me failed'
    return NextResponse.json(
      { error: message, userMessage: 'Post4Me could not generate your post copy. Try again.' },
      { status: 503 }
    )
  }
}
