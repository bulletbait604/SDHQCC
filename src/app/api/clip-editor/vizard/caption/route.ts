import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAuth,
  hasClipEditorAccess,
  AuthError,
  createAuthErrorResponse,
} from '@/lib/auth/verifyAuth'
import { resolveDeepgramApiKey, resolveShotstackApiKey } from '@/lib/clipEditorServerKeys'
import { generatePresignedReadUrl, putTextFileToR2 } from '@/lib/r2'
import {
  shotstackAuthEnvironmentHint,
  shotstackEditApiRoot,
  shotstackEditApiVersion,
  shotstackSubmitUserMessage,
} from '@/lib/shotstackEditUrl'
import type { TargetPlatform } from '@/lib/platformEditing'
import { platformSafeZoneOffsets } from '@/lib/platformEditing'

export const dynamic = 'force-dynamic'

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

function isTargetPlatform(value: string): value is TargetPlatform {
  return value === 'tiktok' || value === 'youtube' || value === 'reels'
}

function cleanCaptionText(text: string | undefined): string | null {
  if (!text) return null
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
  return cleaned.length ? cleaned : null
}

function formatVttTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds)
  const whole = Math.floor(safe)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const secs = whole % 60
  const millis = Math.round((safe - whole) * 1000)
  const pad = (value: number, length = 2) => {
    const raw = String(value)
    return raw.length >= length ? raw : `${'0'.repeat(length - raw.length)}${raw}`
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(millis, 3)}`
}

function buildVtt(transcript: DeepgramTranscription): string | null {
  const words = transcript.results?.channels?.[0]?.alternatives?.[0]?.words || []
  const cues: Array<{ start: number; end: number; text: string }> = []
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

  if (!cues.length) return null
  const lines = ['WEBVTT', '']
  cues.forEach((cue, index) => {
    lines.push(String(index + 1))
    lines.push(`${formatVttTimestamp(cue.start)} --> ${formatVttTimestamp(cue.end)}`)
    lines.push(cue.text)
    lines.push('')
  })
  return lines.join('\n')
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

async function uploadVtt(storageUser: string, vtt: string): Promise<string> {
  const key = `uploads/clips/${storageUser}/${Date.now()}-vizard-captions.vtt`
  const wrote = await putTextFileToR2(key, vtt, 'text/vtt; charset=utf-8')
  if (!wrote) throw new Error('Could not upload caption file to R2')
  const readUrl = await generatePresignedReadUrl(key, 86400)
  if (!readUrl) throw new Error('Could not create caption read URL')
  return readUrl
}

function buildShotstackCaptionEdit(params: {
  videoUrl: string
  captionUrl: string
  platform: TargetPlatform
  durationSeconds: number
}) {
  const safeZone = platformSafeZoneOffsets(params.platform)
  const duration = Math.max(1, Math.min(180, params.durationSeconds))
  return {
    timeline: {
      background: '#000000',
      tracks: [
        {
          clips: [
            {
              asset: {
                type: 'rich-caption',
                src: params.captionUrl,
                font: {
                  family: 'Montserrat ExtraBold',
                  size: params.platform === 'youtube' ? 48 : 54,
                  color: '#ffffff',
                  weight: 800,
                },
                align: { vertical: 'middle' },
                stroke: { width: 4, color: '#000000', opacity: 1 },
                animation: { style: params.platform === 'reels' ? 'highlight' : 'karaoke' },
                active: {
                  font: { color: '#fff200' },
                  stroke: { width: 4, color: '#000000', opacity: 1 },
                },
                style: { textTransform: 'uppercase' },
              },
              start: 0,
              length: Number(duration.toFixed(2)),
              width: 900,
              height: 260,
              offset: { x: 0, y: safeZone.captionY },
            },
          ],
        },
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
    },
  }
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

    const transcript = await transcribeVideo(body.videoUrl)
    const vtt = buildVtt(transcript)
    if (!vtt) throw new Error('Deepgram did not return caption timing for this Vizard clip')

    const storageUser = user.username.replace(/^@/, '').toLowerCase()
    const captionUrl = await uploadVtt(storageUser, vtt)
    const durationSeconds =
      typeof body.videoMsDuration === 'number' && Number.isFinite(body.videoMsDuration)
        ? body.videoMsDuration / 1000
        : 60
    const edit = buildShotstackCaptionEdit({
      videoUrl: body.videoUrl,
      captionUrl,
      platform: body.platform,
      durationSeconds,
    })
    const renderId = await submitShotstack(edit)

    return NextResponse.json({
      renderId,
      shotstackEditVersion: shotstackEditApiVersion(),
      captionProvider: 'deepgram',
      renderer: 'shotstack',
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[clip-editor/vizard/caption]', error)
    const message = error instanceof Error ? error.message : 'Vizard caption render failed'
    return NextResponse.json({ error: message, userMessage: message }, { status: 500 })
  }
}
