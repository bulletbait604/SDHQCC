import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, hasUnlimitedAccess, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { resolveCoinBalanceUserId } from '@/lib/coinUserId'
import { spendToolCoins } from '@/lib/coins/spendToolCoins'
import { toolCoinCost } from '@/lib/coins/toolCosts'
import { deleteFileFromR2, getR2ObjectMetadata } from '@/lib/r2'
import { isSafeR2ObjectKey } from '@/lib/r2KeyValidation'
import { DEFAULT_PLATFORMS } from '@/lib/home/defaultPlatforms'
import {
  POST4ME_CLIP_MAX_BYTES,
  POST4ME_CLIP_MAX_DURATION_SECONDS,
  post4meClipDurationExceededMessage,
} from '@/lib/post4meLimits'
import { generatePost4MeFromClip, estimatePost4MeUsd } from '@/lib/post4meGenerate'
import { buildCombinedPostCaption } from '@/lib/post4meCaption'
import { formatYouTubeTagsForCopy } from '@/lib/clipAnalyzerMetadata'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const POST4ME_COIN_COST = toolCoinCost('post4me') ?? 2

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
      prompt,
    } = body as {
      r2FileKey?: string
      mimeType?: string
      fileName?: string
      fileSize?: number
      durationSeconds?: number
      platform?: string
      prompt?: string
    }

    if (!platform?.trim()) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 })
    }
    if (typeof r2FileKey !== 'string' || !r2FileKey.trim()) {
      return NextResponse.json({ error: 'Clip upload is required' }, { status: 400 })
    }

    const clipKey = r2FileKey.trim()
    const storageUser = user.username.replace(/^@/, '').toLowerCase()
    const prefix = `uploads/post4me-clips/${storageUser}/`
    if (
      !isSafeR2ObjectKey(clipKey) ||
      !clipKey.startsWith(prefix) ||
      clipKey.includes('..')
    ) {
      return NextResponse.json({ error: 'Invalid clip file key' }, { status: 400 })
    }

    const durationSec =
      typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)
        ? durationSeconds
        : undefined
    if (durationSec != null && durationSec > POST4ME_CLIP_MAX_DURATION_SECONDS) {
      return NextResponse.json({ error: post4meClipDurationExceededMessage() }, { status: 400 })
    }

    const meta = await getR2ObjectMetadata(clipKey)
    if (!meta) {
      return NextResponse.json(
        { error: 'Clip not found', userMessage: 'Could not load your upload. Try uploading again.' },
        { status: 404 }
      )
    }
    if (meta.contentLength > POST4ME_CLIP_MAX_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 })
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

    const platformId = platform.trim().toLowerCase()
    const userPrompt = typeof prompt === 'string' ? prompt : ''

    let result
    try {
      result = await generatePost4MeFromClip({
        r2FileKey: clipKey,
        mimeType: mimeType || meta.contentType || 'video/mp4',
        platformId,
        userPrompt,
        durationSeconds: durationSec,
        platforms: DEFAULT_PLATFORMS,
      })
    } finally {
      await deleteFileFromR2(clipKey).catch(() => undefined)
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

    const estimate = estimatePost4MeUsd(durationSec ?? 45)
    const combinedCaption = result.isYouTube ? undefined : buildCombinedPostCaption(result)
    const youtubeTagsCopy = result.isYouTube ? formatYouTubeTagsForCopy(result.tags) : undefined

    return NextResponse.json({
      platform: platformId,
      isYouTube: result.isYouTube,
      title: result.title,
      titles: result.titles,
      description: result.description,
      tags: result.tags,
      combinedCaption,
      youtubeTagsCopy,
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
