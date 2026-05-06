import { NextRequest, NextResponse } from 'next/server'
import RunwayML from '@runwayml/sdk'
import { verifyAuth, hasClipEditorAccess, hasUnlimitedAccess, AuthError } from '@/lib/auth/verifyAuth'
import { resolveCoinBalanceUserId } from '@/lib/coinUserId'
import clientPromise from '@/lib/mongodb'
import { getFileFromR2, getR2ObjectMetadata } from '@/lib/r2'
import { resolveRunwayApiSecret } from '@/lib/clipEditorServerKeys'
import { runwayEphemeralVideoUriFromBuffer } from '@/lib/runwayEphemeralUpload'

export const dynamic = 'force-dynamic'
/** Large R2→Runway transfers may need a higher limit on your host (e.g. Vercel Pro). */
export const maxDuration = 300

const RUNWAY_COIN_COST = 3
/** Runway ephemeral video uploads — aligns with provider docs (vs ~32MB HTTPS URL cap). */
const MAX_RUNWAY_EPHEMERAL_VIDEO_BYTES = 200 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!hasClipEditorAccess(user)) {
      return NextResponse.json({ error: 'Clip Editor requires the Editor badge.' }, { status: 403 })
    }
    const runwaySecret = resolveRunwayApiSecret()
    if (!runwaySecret) {
      return NextResponse.json(
        {
          error: 'Runway is not configured',
          details: 'Set RUNWAYML_API_SECRET or RUNWAY_API.',
        },
        { status: 503 }
      )
    }

    if (!hasUnlimitedAccess(user)) {
      if (user.role !== 'free') {
        return NextResponse.json({ error: 'Access denied. Subscription required.' }, { status: 403 })
      }
      const db = await clientPromise
      const database = db.db('sdhq')
      const balanceKey = await resolveCoinBalanceUserId(database, user)
      const row = await database.collection('coinBalances').findOne({ userId: balanceKey })
      const coins = typeof row?.coins === 'number' ? row.coins : 0
      if (coins < RUNWAY_COIN_COST) {
        return NextResponse.json(
          {
            error: 'Not enough coins',
            userMessage: `Starting a Runway render needs at least ${RUNWAY_COIN_COST} coins.`,
          },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const { r2FileKey, promptText, model, duration, ratio, seed } = body as {
      r2FileKey?: string
      promptText?: string
      model?: 'gen4_aleph' | 'seedance2' | 'gen4.5' | string
      duration?: number
      ratio?: '1280:720' | '720:1280'
      seed?: number
    }

    if (!promptText || typeof promptText !== 'string' || promptText.trim().length < 4) {
      return NextResponse.json({ error: 'promptText is required' }, { status: 400 })
    }

    const normalizedModel =
      model === 'seedance2'
        ? 'seedance2'
        : model === 'gen4.5' || model === 'gen4_5'
          ? 'gen4.5'
          : 'gen4_aleph'

    const storageUser = user.username.replace(/^@/, '').toLowerCase()
    const prefix = `uploads/clips/${storageUser}/`

    let videoUri: string | null = null
    let metaContentLength: number | null = null

    const client = new RunwayML({ apiKey: runwaySecret })

    if (normalizedModel !== 'gen4.5') {
      if (!r2FileKey || typeof r2FileKey !== 'string') {
        return NextResponse.json(
          { error: 'r2FileKey is required for video-to-video models (Aleph / Seedance2)' },
          { status: 400 }
        )
      }
      if (!r2FileKey.startsWith(prefix) || r2FileKey.includes('..') || r2FileKey.length > 500) {
        return NextResponse.json({ error: 'Invalid clip file key' }, { status: 400 })
      }

      const meta = await getR2ObjectMetadata(r2FileKey)
      if (!meta) {
        return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
      }
      if (meta.contentLength > MAX_RUNWAY_EPHEMERAL_VIDEO_BYTES) {
        return NextResponse.json(
          {
            error: `File too large for Runway ephemeral upload (max ${MAX_RUNWAY_EPHEMERAL_VIDEO_BYTES / (1024 * 1024)}MB)`,
          },
          { status: 400 }
        )
      }

      metaContentLength = meta.contentLength
      const buffer = await getFileFromR2(r2FileKey)
      if (!buffer) {
        return NextResponse.json({ error: 'Could not read clip from storage' }, { status: 503 })
      }
      const filename = r2FileKey.split('/').pop() || 'clip.mp4'
      const mimeType = meta.contentType || 'video/mp4'
      try {
        videoUri = await runwayEphemeralVideoUriFromBuffer(
          client,
          buffer,
          filename,
          mimeType
        )
      } catch (uploadErr) {
        console.error('[clip-editor/runway] Runway ephemeral upload failed:', uploadErr)
        const msg = uploadErr instanceof Error ? uploadErr.message : 'Runway upload failed'
        return NextResponse.json({ error: msg }, { status: 502 })
      }
    } else if (r2FileKey && typeof r2FileKey === 'string') {
      if (r2FileKey.startsWith(prefix) && !r2FileKey.includes('..') && r2FileKey.length <= 500) {
        const meta = await getR2ObjectMetadata(r2FileKey)
        if (meta) metaContentLength = meta.contentLength
      }
    }

    let task

    if (normalizedModel === 'gen4.5') {
      const pt = promptText.trim()
      if (pt.length > 1000) {
        return NextResponse.json(
          { error: 'promptText must be 1000 characters or less for gen4.5' },
          { status: 400 }
        )
      }
      let d =
        typeof duration === 'number' && Number.isInteger(duration) ? duration : 5
      if (d < 2 || d > 10) {
        return NextResponse.json(
          { error: 'gen4.5 duration must be an integer from 2 to 10 seconds' },
          { status: 400 }
        )
      }
      const vidRatio: '1280:720' | '720:1280' =
        ratio === '720:1280' || ratio === '1280:720' ? ratio : '1280:720'

      const gen45Params: {
        model: 'gen4.5'
        promptText: string
        ratio: '1280:720' | '720:1280'
        duration: number
        seed?: number
      } = {
        model: 'gen4.5',
        promptText: pt,
        ratio: vidRatio,
        duration: d,
      }
      if (typeof seed === 'number' && Number.isInteger(seed)) {
        gen45Params.seed = seed
      }

      task = await client.textToVideo.create(gen45Params)
    } else if (normalizedModel === 'gen4_aleph') {
      const pt = promptText.trim()
      if (!videoUri) {
        return NextResponse.json({ error: 'Missing video URI for Aleph' }, { status: 500 })
      }
      if (pt.length > 1000) {
        return NextResponse.json(
          { error: 'promptText must be 1000 characters or less for gen4_aleph' },
          { status: 400 }
        )
      }
      task = await client.videoToVideo.create({
        model: 'gen4_aleph',
        videoUri,
        promptText: pt,
      })
    } else {
      const d =
        typeof duration === 'number' && Number.isInteger(duration)
          ? duration
          : 8
      if (!videoUri) {
        return NextResponse.json({ error: 'Missing video URI for Seedance2' }, { status: 500 })
      }
      if (d < 4 || d > 15) {
        return NextResponse.json(
          { error: 'seedance2 duration must be an integer from 4 to 15' },
          { status: 400 }
        )
      }
      task = await client.videoToVideo.create({
        model: 'seedance2',
        promptVideo: videoUri,
        promptText: promptText.trim(),
        duration: d,
      })
    }

    return NextResponse.json({
      taskId: task.id,
      runwayModel: normalizedModel,
      ...(metaContentLength != null ? { inputContentLength: metaContentLength } : {}),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[clip-editor/runway]', error)
    const message = error instanceof Error ? error.message : 'Runway task failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
