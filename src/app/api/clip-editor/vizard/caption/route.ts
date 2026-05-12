import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAuth,
  hasClipEditorAccess,
  AuthError,
  createAuthErrorResponse,
} from '@/lib/auth/verifyAuth'
import { resolveDeepgramApiKey, resolveShotstackApiKey } from '@/lib/clipEditorServerKeys'
import { generatePresignedReadUrl, putBufferToR2 } from '@/lib/r2'
import {
  shotstackAuthEnvironmentHint,
  shotstackEditApiRoot,
  shotstackEditApiVersion,
  shotstackSubmitUserMessage,
} from '@/lib/shotstackEditUrl'
import type { TargetPlatform } from '@/lib/platformEditing'
import { platformSafeZoneOffsets } from '@/lib/platformEditing'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_VIZARD_STAGE_BYTES = 250 * 1024 * 1024

type DeepgramTranscription = {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        words?: Array<{
          word?: string
          punctuated_word?: string
          start?: number
          end?: number
        }>
      }>
    }>
  }
}

type CaptionCue = {
  start: number
  end: number
  text: string
}

function isTargetPlatform(value: string): value is TargetPlatform {
  return value === 'tiktok' || value === 'youtube' || value === 'reels'
}

function cleanCaptionText(text: string | undefined): string | null {
  if (!text) return null
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/[^\w\s.,!?'"#@:-]/g, '')
    .trim()
  return cleaned.length ? cleaned : null
}

function buildCaptionCues(transcript: DeepgramTranscription): CaptionCue[] {
  const words = transcript.results?.channels?.[0]?.alternatives?.[0]?.words || []
  const cues: CaptionCue[] = []
  let cueWords: string[] = []
  let cueStart: number | null = null
  let cueEnd: number | null = null

  const flush = () => {
    if (cueStart == null || cueEnd == null || cueEnd <= cueStart || cueWords.length === 0) {
      cueWords = []
      cueStart = null
      cueEnd = null
      return
    }
    const text = cleanCaptionText(cueWords.join(' '))
    if (text) cues.push({ start: cueStart, end: Math.max(cueStart + 0.7, cueEnd), text })
    cueWords = []
    cueStart = null
    cueEnd = null
  }

  for (const word of words) {
    const text = cleanCaptionText(word.punctuated_word || word.word)
    const start = typeof word.start === 'number' && Number.isFinite(word.start) ? word.start : null
    const end = typeof word.end === 'number' && Number.isFinite(word.end) ? word.end : null
    if (!text || start == null || end == null || end <= start) continue

    if (cueStart == null) cueStart = start
    const gap = cueEnd == null ? 0 : start - cueEnd
    if (cueWords.length >= 5 || gap > 0.45 || /[.!?]$/.test(cueWords[cueWords.length - 1] || '')) {
      flush()
      cueStart = start
    }

    cueWords.push(text)
    cueEnd = end
  }
  flush()
  return cues
}

async function transcribeVideo(videoUrl: string): Promise<DeepgramTranscription> {
  const apiKey = resolveDeepgramApiKey()
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY is not configured')

  const model = (process.env.CLIP_EDITOR_TRANSCRIPTION_MODEL || process.env.DEEPGRAM_MODEL || 'nova-3').trim()
  const url = new URL('https://api.deepgram.com/v1/listen')
  url.searchParams.set('model', model)
  url.searchParams.set('smart_format', 'true')
  url.searchParams.set('punctuate', 'true')

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: videoUrl }),
  })
  if (!res.ok) throw new Error(`Deepgram transcription failed: ${res.status}`)
  return (await res.json()) as DeepgramTranscription
}

function buildShotstackCaptionEdit(params: {
  videoUrl: string
  platform: TargetPlatform
  durationSeconds: number
  cues: CaptionCue[]
  title?: string
  viralScore?: string
  viralReason?: string
}) {
  const safeZone = platformSafeZoneOffsets(params.platform)
  const duration = Math.max(1, Math.min(180, params.durationSeconds))
  const title = cleanCaptionText(params.title)?.slice(0, 70)
  const score = cleanCaptionText(params.viralScore ? `VIRAL SCORE ${params.viralScore}/10` : undefined)
  const stickerText =
    cleanCaptionText(
      params.viralReason?.match(/\b(clutch|fail|funny|insane|crazy|wild|epic|win|rage|shock|wow)\b/i)?.[0] ||
        title?.match(/\b(clutch|fail|funny|insane|crazy|wild|epic|win|rage|shock|wow)\b/i)?.[0] ||
        'WATCH'
    )?.toUpperCase() || 'WATCH'
  const captionClips = params.cues.slice(0, 70).map((cue) => {
    const start = Math.max(0, Math.min(duration - 0.2, cue.start))
    const length = Math.max(0.7, Math.min(3.1, cue.end - cue.start))
    return {
      asset: {
        type: 'text',
        text: cue.text.toUpperCase().slice(0, 84),
        width: 960,
        height: 220,
        font: {
          family: 'Montserrat ExtraBold',
          color: '#ffffff',
          size: params.platform === 'youtube' ? 36 : 42,
          weight: 800,
          lineHeight: 1.05,
        },
        alignment: { horizontal: 'center', vertical: 'center' },
        stroke: { width: 3, color: '#000000' },
        background: {
          color: '#000000',
          opacity: 0.38,
          padding: 9,
          borderRadius: 10,
        },
      },
      start: Number(start.toFixed(2)),
      length: Number(Math.min(length, duration - start).toFixed(2)),
      offset: { x: 0, y: safeZone.captionY },
      transition: { in: 'fadeFast', out: 'fadeFast' },
    }
  })

  const hookClips = title
    ? [
        {
          asset: {
            type: 'text',
            text: title.toUpperCase(),
            width: 960,
            height: 220,
            font: {
              family: 'Montserrat ExtraBold',
              color: '#fff200',
              size: 54,
              weight: 900,
              lineHeight: 1.02,
            },
            alignment: { horizontal: 'center', vertical: 'center' },
            stroke: { width: 4, color: '#000000' },
            background: {
              color: '#ff2d55',
              opacity: 0.68,
              padding: 12,
              borderRadius: 16,
            },
          },
          start: 0,
          length: Number(Math.min(2.4, duration).toFixed(2)),
          offset: { x: 0, y: 0.29 },
          transition: { in: 'slideUp', out: 'fadeFast' },
        },
      ]
    : []

  const badgeClips = score
    ? [
        {
          asset: {
            type: 'text',
            text: score,
            width: 310,
            height: 110,
            font: {
              family: 'Montserrat ExtraBold',
              color: '#ffffff',
              size: 32,
              weight: 800,
            },
            alignment: { horizontal: 'center', vertical: 'center' },
            stroke: { width: 3, color: '#000000' },
            background: {
              color: '#7c3aed',
              opacity: 0.7,
              padding: 8,
              borderRadius: 18,
            },
          },
          start: 0.35,
          length: Number(Math.min(2.2, duration).toFixed(2)),
          offset: { x: 0.31, y: 0.31 },
          transition: { in: 'zoomFast', out: 'fadeFast' },
        },
      ]
    : []

  const stickerClips = [
    {
      asset: {
        type: 'text',
        text: stickerText,
        width: 270,
        height: 110,
        font: {
          family: 'Montserrat ExtraBold',
          color: '#ffffff',
          size: 42,
          weight: 900,
        },
        alignment: { horizontal: 'center', vertical: 'center' },
        stroke: { width: 3, color: '#000000' },
        background: {
          color: '#ff2d55',
          opacity: 0.72,
          padding: 8,
          borderRadius: 18,
        },
      },
      start: Number(Math.min(1.2, Math.max(0, duration - 1)).toFixed(2)),
      length: Number(Math.min(1.8, duration).toFixed(2)),
      offset: { x: -0.31, y: 0.25 },
      transition: { in: 'zoomFast', out: 'fadeFast' },
    },
    ...(duration > 5
      ? [
          {
            asset: {
              type: 'text',
              text: params.platform === 'youtube' ? 'SHORTS' : 'REELS',
              width: 270,
              height: 100,
              font: {
                family: 'Montserrat ExtraBold',
                color: '#000000',
                size: 36,
                weight: 900,
              },
              alignment: { horizontal: 'center', vertical: 'center' },
              background: {
                color: '#fff200',
                opacity: 0.78,
                padding: 8,
                borderRadius: 18,
              },
            },
            start: Number(Math.max(2.8, duration * 0.38).toFixed(2)),
            length: 1.6,
            offset: { x: 0.31, y: -0.16 },
            transition: { in: 'slideUp', out: 'fadeFast' },
          },
        ]
      : []),
  ]

  const ctaClip =
    duration >= 6
      ? [
          {
            asset: {
              type: 'text',
              text: params.platform === 'youtube' ? 'SUBSCRIBE FOR MORE' : 'FOLLOW FOR MORE',
              width: 760,
              height: 140,
              font: {
                family: 'Montserrat ExtraBold',
                color: '#ffffff',
                size: 42,
                weight: 800,
              },
              alignment: { horizontal: 'center', vertical: 'center' },
              stroke: { width: 3, color: '#000000' },
              background: {
                color: '#06111f',
                opacity: 0.7,
                padding: 10,
                borderRadius: 16,
              },
            },
            start: Number(Math.max(0, duration - 2).toFixed(2)),
            length: Number(Math.min(1.8, duration).toFixed(2)),
            offset: { x: 0, y: 0.02 },
            transition: { in: 'slideUp', out: 'fade' },
          },
        ]
      : []

  return {
    timeline: {
      background: '#000000',
      tracks: [
        {
          clips: [
            {
              asset: {
                type: 'video',
                src: params.videoUrl,
                transcode: true,
              },
              start: 0,
              length: Number(duration.toFixed(2)),
              fit: 'crop',
              position: 'center',
            },
          ],
        },
        ...(hookClips.length ? [{ clips: hookClips }] : []),
        ...(badgeClips.length ? [{ clips: badgeClips }] : []),
        { clips: stickerClips },
        ...(captionClips.length ? [{ clips: captionClips }] : []),
        ...(ctaClip.length ? [{ clips: ctaClip }] : []),
      ],
    },
    output: {
      format: 'mp4',
      size: {
        width: 1080,
        height: 1920,
      },
      fps: 30,
    },
    metadata: {
      renderer: 'vizard-deepgram-shotstack',
      platform: params.platform,
      visualPackage: {
        hook: Boolean(hookClips.length),
        badges: badgeClips.length,
        stickers: stickerClips.length,
        subtitles: captionClips.length,
        cta: Boolean(ctaClip.length),
      },
    },
  }
}

async function stageVizardVideo(params: {
  sourceUrl: string
  storageUser: string
}): Promise<{ readUrl: string; contentType: string; contentLength: number }> {
  const res = await fetch(params.sourceUrl, {
    method: 'GET',
    headers: {
      Accept: 'video/mp4,video/*,*/*',
      'User-Agent': 'SDHQ-Creator-Corner/1.0',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Could not download Vizard video for captioning: ${res.status}`)
  }
  const contentType = res.headers.get('content-type') || 'video/mp4'
  const arrayBuffer = await res.arrayBuffer()
  if (arrayBuffer.byteLength <= 0) {
    throw new Error('Vizard video download was empty')
  }
  if (arrayBuffer.byteLength > MAX_VIZARD_STAGE_BYTES) {
    throw new Error('Vizard video is too large to stage for captioning')
  }

  const key = `uploads/clips/${params.storageUser}/${Date.now()}-vizard-cut.mp4`
  const wrote = await putBufferToR2(key, Buffer.from(arrayBuffer), contentType)
  if (!wrote) {
    throw new Error('Could not stage Vizard video in R2')
  }
  const readUrl = await generatePresignedReadUrl(key, 86400)
  if (!readUrl) {
    throw new Error('Could not create staged Vizard video URL')
  }
  return { readUrl, contentType, contentLength: arrayBuffer.byteLength }
}

async function submitShotstack(edit: Record<string, unknown>): Promise<string> {
  const apiKey = resolveShotstackApiKey()
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY is not configured')

  const res = await fetch(`${shotstackEditApiRoot()}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(edit),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((shotstackSubmitUserMessage(data) + shotstackAuthEnvironmentHint(res.status)).trim())
  }
  const renderId =
    (data as { response?: { id?: string } }).response?.id ||
    (data as { id?: string }).id ||
    null
  if (!renderId) throw new Error('Shotstack did not return a render id')
  return renderId
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!hasClipEditorAccess(user)) {
      return NextResponse.json({ error: 'Clip Editor requires the Editor badge.' }, { status: 403 })
    }

    const body = (await request.json()) as {
      videoUrl?: string
      platform?: string
      videoMsDuration?: number
      title?: string
      viralScore?: string
      viralReason?: string
    }
    if (!body.videoUrl || !/^https?:\/\//i.test(body.videoUrl)) {
      return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 })
    }
    if (!body.platform || !isTargetPlatform(body.platform)) {
      return NextResponse.json(
        { error: "platform is required and must be one of: 'tiktok' | 'youtube' | 'reels'" },
        { status: 400 }
      )
    }

    const storageUser = user.username.replace(/^@/, '').toLowerCase()
    const staged = await stageVizardVideo({
      sourceUrl: body.videoUrl,
      storageUser,
    })

    const transcript = await transcribeVideo(staged.readUrl)
    const cues = buildCaptionCues(transcript)
    if (!cues.length) throw new Error('Deepgram did not return caption timing for this Vizard clip')

    const durationSeconds =
      typeof body.videoMsDuration === 'number' && Number.isFinite(body.videoMsDuration)
        ? body.videoMsDuration / 1000
        : 60
    const edit = buildShotstackCaptionEdit({
      videoUrl: staged.readUrl,
      platform: body.platform,
      durationSeconds,
      cues,
      title: body.title,
      viralScore: body.viralScore,
      viralReason: body.viralReason,
    })
    const renderId = await submitShotstack(edit)

    return NextResponse.json({
      renderId,
      shotstackEditVersion: shotstackEditApiVersion(),
      captionProvider: 'deepgram',
      renderer: 'shotstack',
      stagedSourceBytes: staged.contentLength,
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[clip-editor/vizard/caption]', error)
    const message = error instanceof Error ? error.message : 'Vizard caption render failed'
    return NextResponse.json({ error: message, userMessage: message }, { status: 500 })
  }
}
