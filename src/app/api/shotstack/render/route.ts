import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAuth,
  hasClipEditorAccess,
  AuthError,
  createAuthErrorResponse,
} from '@/lib/auth/verifyAuth'
import {
  shotstackEditApiRoot,
  shotstackEditApiVersion,
  shotstackAuthEnvironmentHint,
  shotstackSubmitUserMessage,
} from '@/lib/shotstackEditUrl'
import {
  resolveShotstackApiKey,
  SHOTSTACK_KEY_MISSING_USER_MESSAGE,
  shotstackKeyMissingEnvHint,
} from '@/lib/clipEditorServerKeys'

export const dynamic = 'force-dynamic'

type ClipLike = Record<string, unknown>
type TrackLike = { clips?: ClipLike[] }

const ALLOWED_EFFECTS = new Set([
  'zoomIn',
  'zoomInSlow',
  'zoomInFast',
  'zoomOut',
  'zoomOutSlow',
  'zoomOutFast',
  'slideLeft',
  'slideLeftSlow',
  'slideLeftFast',
  'slideRight',
  'slideRightSlow',
  'slideRightFast',
  'slideUp',
  'slideUpSlow',
  'slideUpFast',
  'slideDown',
  'slideDownSlow',
  'slideDownFast',
])

const ALLOWED_TRANSITIONS = new Set([
  'fade',
  'fadeSlow',
  'fadeFast',
  'reveal',
  'revealSlow',
  'revealFast',
  'wipeLeft',
  'wipeLeftSlow',
  'wipeLeftFast',
  'wipeRight',
  'wipeRightSlow',
  'wipeRightFast',
  'slideLeft',
  'slideLeftSlow',
  'slideLeftFast',
  'slideRight',
  'slideRightSlow',
  'slideRightFast',
  'slideUp',
  'slideUpSlow',
  'slideUpFast',
  'slideDown',
  'slideDownSlow',
  'slideDownFast',
  'carouselLeft',
  'carouselLeftSlow',
  'carouselLeftFast',
  'carouselRight',
  'carouselRightSlow',
  'carouselRightFast',
  'carouselUp',
  'carouselUpSlow',
  'carouselUpFast',
  'carouselDown',
  'carouselDownSlow',
  'carouselDownFast',
  'shuffleTopRight',
  'shuffleTopRightSlow',
  'shuffleTopRightFast',
  'shuffleRightTop',
  'shuffleRightTopSlow',
  'shuffleRightTopFast',
  'shuffleRightBottom',
  'shuffleRightBottomSlow',
  'shuffleRightBottomFast',
  'shuffleBottomRight',
  'shuffleBottomRightSlow',
  'shuffleBottomRightFast',
  'shuffleBottomLeft',
  'shuffleBottomLeftSlow',
  'shuffleBottomLeftFast',
  'shuffleLeftBottom',
  'shuffleLeftBottomSlow',
  'shuffleLeftBottomFast',
  'shuffleLeftTop',
  'shuffleLeftTopSlow',
  'shuffleLeftTopFast',
  'shuffleTopLeft',
  'shuffleTopLeftSlow',
  'shuffleTopLeftFast',
  /** Clip transitions: API allows `zoom` only (not zoomFast/zoomSlow). */
  'zoom',
])

function sanitizeClip(clip: ClipLike): ClipLike {
  const out: ClipLike = { ...clip }
  const effect = out.effect
  if (typeof effect === 'string' && !ALLOWED_EFFECTS.has(effect)) {
    delete out.effect
  }

  const transition = out.transition
  if (transition && typeof transition === 'object' && !Array.isArray(transition)) {
    const t = transition as Record<string, unknown>
    const next: Record<string, string> = {}
    const coerceTransition = (v: unknown): string | null => {
      if (typeof v !== 'string') return null
      if (v === 'zoomFast' || v === 'zoomSlow') return 'zoom'
      return v
    }
    const tin = coerceTransition(t.in)
    const tout = coerceTransition(t.out)
    if (tin && ALLOWED_TRANSITIONS.has(tin)) next.in = tin
    if (tout && ALLOWED_TRANSITIONS.has(tout)) next.out = tout
    if (Object.keys(next).length > 0) out.transition = next
    else delete out.transition
  } else if (typeof transition === 'string') {
    const coerced = transition === 'zoomFast' || transition === 'zoomSlow' ? 'zoom' : transition
    if (ALLOWED_TRANSITIONS.has(coerced)) {
      out.transition = { in: coerced, out: 'fade' }
    } else {
      delete out.transition
    }
  } else if (transition != null) {
    delete out.transition
  }

  return out
}

function sanitizeTimeline(timeline: Record<string, unknown>): Record<string, unknown> {
  const tracks = Array.isArray(timeline.tracks) ? (timeline.tracks as TrackLike[]) : []
  const safeTracks = tracks
    .map((track) => {
      const clips = Array.isArray(track.clips) ? track.clips.map((clip) => sanitizeClip(clip)) : []
      return { ...track, clips }
    })
    .filter((track) => Array.isArray(track.clips) && track.clips.length > 0)

  return {
    ...timeline,
    tracks: safeTracks,
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!hasClipEditorAccess(user)) {
      return NextResponse.json({ error: 'Clip Editor requires the Editor badge.' }, { status: 403 })
    }
    const apiKey = resolveShotstackApiKey()
    if (!apiKey) {
      const envHint = shotstackKeyMissingEnvHint()
      return NextResponse.json(
        {
          error: 'SHOTSTACK_API_KEY is not configured',
          userMessage: SHOTSTACK_KEY_MISSING_USER_MESSAGE,
          ...(envHint ? { envHint } : {}),
        },
        { status: 503 }
      )
    }

    const body = (await request.json()) as {
      timeline?: Record<string, unknown>
      output?: Record<string, unknown>
    }
    if (!body.timeline || !body.output) {
      return NextResponse.json({ error: 'timeline and output are required' }, { status: 400 })
    }

    const timeline = sanitizeTimeline(body.timeline)
    const res = await fetch(`${shotstackEditApiRoot()}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        timeline,
        output: body.output,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const base = shotstackSubmitUserMessage(data)
      const userMessage = (base + shotstackAuthEnvironmentHint(res.status)).trim()
      return NextResponse.json(
        {
          error: userMessage,
          userMessage,
          shotstackHttpStatus: res.status,
          shotstackEditVersion: shotstackEditApiVersion(),
          provider: data,
        },
        { status: 502 }
      )
    }

    const renderId =
      (data as { response?: { id?: string } }).response?.id ||
      (data as { id?: string }).id ||
      null
    if (!renderId) {
      return NextResponse.json({ error: 'Shotstack did not return a render id', provider: data }, { status: 502 })
    }

    return NextResponse.json({ renderId })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    const message = error instanceof Error ? error.message : 'Shotstack submit failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
