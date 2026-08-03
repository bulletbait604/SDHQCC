import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { spendToolCoins } from '@/lib/coins/spendToolCoins'
import { toolCoinCost } from '@/lib/coins/toolCosts'
import {
  estimateThumbnail2Usd,
  paintThumbnail2,
} from '@/lib/thumbnail2Pipeline'
import { thumbnailVideoAnalysisSchema } from '@/lib/thumbnailVideoAnalysisSchema'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const COIN_COST = toolCoinCost('thumbnail-2') ?? 3

/** Owner-only: paint viral overlays on the client-captured frame. */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyOwnerUser(req)

    const spend = await spendToolCoins(user, 'thumbnail-2')
    if (!spend.ok) {
      return NextResponse.json(
        { error: spend.reason, required: spend.required, available: spend.available },
        { status: spend.status }
      )
    }

    const body = await req.json()
    const {
      platformId,
      analysis,
      imageBase64,
      mimeType,
      prompt,
      durationSeconds,
    } = body as {
      platformId?: string
      analysis?: unknown
      imageBase64?: string
      mimeType?: string
      prompt?: string
      durationSeconds?: number
    }

    const platform =
      typeof platformId === 'string' && platformId.trim() ? platformId.trim() : 'youtube-shorts'

    if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
      return NextResponse.json(
        { error: 'Captured frame is required. Re-upload the clip and try again.' },
        { status: 400 }
      )
    }

    let parsedAnalysis
    try {
      parsedAnalysis = thumbnailVideoAnalysisSchema.parse(analysis)
    } catch {
      return NextResponse.json({ error: 'Invalid clip analysis payload' }, { status: 400 })
    }

    const sessionId = randomUUID()
    const out = await paintThumbnail2({
      platformId: platform,
      analysis: parsedAnalysis,
      imageBase64: imageBase64.replace(/^data:[^;]+;base64,/, ''),
      mimeType: typeof mimeType === 'string' && mimeType ? mimeType : 'image/jpeg',
      userPrompt: typeof prompt === 'string' ? prompt : '',
      sessionId,
    })

    const estimate = estimateThumbnail2Usd(
      typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)
        ? durationSeconds
        : 60
    )

    return NextResponse.json({
      key: out.key,
      url: `/api/image?key=${encodeURIComponent(out.key)}`,
      mimeType: out.mimeType,
      description: out.description,
      model: out.model,
      imageModel: out.model,
      videoModel:
        process.env.THUMBNAIL2_VIDEO_MODEL?.trim() || 'gemini-3.1-flash-lite',
      coinCost: COIN_COST,
      estimatedCostUsd: estimate.estimatedCostUsd,
      estimatedCostNote: estimate.estimatedCostNote,
    })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[Thumbnail2 generate]', err)
    const message = err instanceof Error ? err.message : 'Generate failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
