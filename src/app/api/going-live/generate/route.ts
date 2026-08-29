import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { runGoingLivePipeline } from '@/lib/goingLive/generate'
import {
  MAX_GOING_LIVE_REFS,
  MAX_STREAM_TOPIC_CHARS,
  getGoingLiveStreaming,
  getGoingLiveTone,
  isGoingLiveStreamingId,
  isGoingLiveToneId,
  normalizeSocialIds,
  normalizeStreamUsername,
} from '@/lib/goingLive/platforms'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_IMAGE_BYTES = 1.2 * 1024 * 1024
const MAX_TOTAL_REF_BYTES = 3.8 * 1024 * 1024

type IncomingRef = {
  base64?: string
  mimeType?: string
}

function normalizeRef(raw: IncomingRef): { base64: string; mimeType: string; bytes: number } | null {
  if (typeof raw?.base64 !== 'string' || !raw.base64.trim()) return null
  const base64 = raw.base64.replace(/^data:[^;]+;base64,/, '').trim()
  if (!base64) return null
  const approxBytes = Math.floor((base64.length * 3) / 4)
  if (approxBytes > MAX_IMAGE_BYTES) return null
  const mimeType =
    typeof raw.mimeType === 'string' && raw.mimeType.startsWith('image/')
      ? raw.mimeType
      : 'image/jpeg'
  return { base64, mimeType, bytes: approxBytes }
}

/** Owner-only R&D: go-live stream title + social posts + posters. */
export async function POST(req: NextRequest) {
  try {
    await verifyOwnerUser(req)

    const body = await req.json()
    const {
      streamingPlatformId,
      socialPlatformIds,
      toneId,
      username: usernameRaw,
      topic: topicRaw,
      references,
    } = body as {
      streamingPlatformId?: string
      socialPlatformIds?: unknown
      toneId?: string
      username?: unknown
      topic?: unknown
      references?: IncomingRef[]
    }

    if (!streamingPlatformId || !isGoingLiveStreamingId(streamingPlatformId)) {
      return NextResponse.json({ error: 'Choose a streaming platform.' }, { status: 400 })
    }
    const streaming = getGoingLiveStreaming(streamingPlatformId)
    if (!streaming) {
      return NextResponse.json({ error: 'Unknown streaming platform.' }, { status: 400 })
    }

    const socialIds = normalizeSocialIds(socialPlatformIds)
    if (socialIds.length === 0) {
      return NextResponse.json(
        { error: 'Select at least one social media platform.' },
        { status: 400 }
      )
    }

    if (!toneId || !isGoingLiveToneId(toneId)) {
      return NextResponse.json({ error: 'Choose a vibe / tone.' }, { status: 400 })
    }
    const tone = getGoingLiveTone(toneId)
    if (!tone) {
      return NextResponse.json({ error: 'Unknown vibe / tone.' }, { status: 400 })
    }

    const username = normalizeStreamUsername(usernameRaw)
    if (!username) {
      return NextResponse.json({ error: 'Enter a stream username.' }, { status: 400 })
    }

    const topic =
      typeof topicRaw === 'string' ? topicRaw.trim().slice(0, MAX_STREAM_TOPIC_CHARS) : ''

    const refsIn = Array.isArray(references) ? references.slice(0, MAX_GOING_LIVE_REFS) : []
    const refs = refsIn.map(normalizeRef).filter(Boolean) as {
      base64: string
      mimeType: string
      bytes: number
    }[]

    if (refs.length === 0) {
      return NextResponse.json(
        {
          error: 'Upload 1–4 reference images (each under ~1.2MB after compression).',
          userMessage: 'Reference images are too large or missing. Try smaller JPGs.',
        },
        { status: 400 }
      )
    }

    const totalBytes = refs.reduce((sum, r) => sum + r.bytes, 0)
    if (totalBytes > MAX_TOTAL_REF_BYTES) {
      return NextResponse.json(
        {
          error: 'Reference images total size is too large.',
          userMessage: 'Use fewer or smaller reference images and try again.',
        },
        { status: 413 }
      )
    }

    const result = await runGoingLivePipeline({
      streaming,
      socialIds,
      tone,
      username,
      topic,
      references: refs.map(({ base64, mimeType }) => ({ base64, mimeType })),
      sessionId: randomUUID(),
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[going-live]', err)
    const message = err instanceof Error ? err.message : 'Going Live generation failed'
    return NextResponse.json(
      {
        error: message,
        userMessage: 'Could not generate go-live posts. Try again with clearer photos.',
      },
      { status: 503 }
    )
  }
}
