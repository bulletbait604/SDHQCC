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
import { normalizeHttpMediaUrl } from '@/lib/normalizeMediaUrl'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_VIZARD_STAGE_BYTES = 250 * 1024 * 1024

type DeepgramTranscription = {
  /** Media length in seconds — caps the Shotstack timeline when probe fails (common 400: overlays past real video). */
  metadata?: { duration?: number }
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

/** Vizard sometimes returns duration as a string in JSON. */
function coerceVideoMsDuration(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string') {
    const n = Number(value.trim())
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

function maxCueEndSeconds(cues: CaptionCue[]): number {
  let m = 0
  for (const c of cues) m = Math.max(m, c.end)
  return m
}

function readDeepgramMediaDurationSeconds(transcript: DeepgramTranscription): number | null {
  const d = transcript.metadata?.duration
  if (typeof d === 'number' && Number.isFinite(d) && d > 0.05) return d
  return null
}

/**
 * ffprobe can mis-read some MP4s (wrong stream, ms vs s). Ignore absurdly short probes when
 * word timings clearly span a longer clip.
 */
function trustedProbeDurationSeconds(
  probed: number | null,
  minCueEnd: number
): number | null {
  if (probed == null || !Number.isFinite(probed) || probed <= 0.05) return null
  if (probed < 0.45 && minCueEnd > 2.5) return null
  return probed
}

/**
 * Shotstack rejects timelines where any clip ends after the composition length
 * (often HTTP 400 "Bad Request"). Keep [start, start+length] inside [0, duration].
 */
function fitClipInTimeline(
  start: number,
  length: number,
  duration: number,
  minLength = 0.2
): { start: number; length: number } {
  const d = Math.max(minLength + 0.06, duration)
  let s = Math.max(0, Math.min(Math.max(0, d - minLength - 0.02), start))
  let len = Math.max(minLength, length)
  if (s + len > d) {
    len = Math.max(minLength, d - s - 0.02)
  }
  if (s + len > d) {
    s = Math.max(0, d - len - 0.02)
  }
  return { start: Number(s.toFixed(2)), length: Number(Math.max(minLength, len).toFixed(2)) }
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
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    const hint = errBody ? ` — ${errBody.slice(0, 280)}` : ''
    throw new Error(`Deepgram transcription failed (${res.status})${hint}`)
  }
  return (await res.json()) as DeepgramTranscription
}

/**
 * Shotstack ffprobe for a public URL — caps our timeline so clip length never exceeds the real file
 * (common Edit API HTTP 400 when durationSeconds > actual media).
 */
async function probeShotstackSourceDurationSeconds(mediaUrl: string): Promise<number | null> {
  const apiKey = resolveShotstackApiKey()
  if (!apiKey) return null
  const encoded = encodeURIComponent(mediaUrl)
  if (encoded.length > 7500) return null
  try {
    const res = await fetch(`${shotstackEditApiRoot()}/probe/${encoded}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-api-key': apiKey,
      },
      cache: 'no-store',
    })
    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean
      response?: {
        format?: { duration?: string | number }
        streams?: Array<{ duration?: string | number }>
      }
    }
    if (!res.ok || body.success === false || !body.response) return null
    const r = body.response
    const fmtDur = r.format?.duration
    if (typeof fmtDur === 'number' && Number.isFinite(fmtDur) && fmtDur > 0.05) return fmtDur
    if (typeof fmtDur === 'string') {
      const n = Number(fmtDur)
      if (Number.isFinite(n) && n > 0.05) return n
    }
    const s0 = r.streams?.[0]
    const s0d = s0?.duration
    if (typeof s0d === 'number' && Number.isFinite(s0d) && s0d > 0.05) return s0d
    if (typeof s0d === 'string') {
      const n = Number(s0d)
      if (Number.isFinite(n) && n > 0.05) return n
    }
    return null
  } catch {
    return null
  }
}

function buildShotstackCaptionEdit(params: {
  videoUrl: string
  platform: TargetPlatform
  durationSeconds: number
  /** Exact base-video length in seconds; omit to use Shotstack smart length `auto` (full asset). */
  videoClipLengthSeconds?: number | null
  cues: CaptionCue[]
  title?: string
  viralScore?: string
  viralReason?: string
}) {
  const safeZone = platformSafeZoneOffsets(params.platform)
  const duration = Math.max(0.75, Math.min(180, params.durationSeconds))
  const title = cleanCaptionText(params.title)?.slice(0, 70)
  const score = cleanCaptionText(params.viralScore ? `VIRAL SCORE ${params.viralScore}/10` : undefined)
  const stickerText =
    cleanCaptionText(
      params.viralReason?.match(/\b(clutch|fail|funny|insane|crazy|wild|epic|win|rage|shock|wow)\b/i)?.[0] ||
        title?.match(/\b(clutch|fail|funny|insane|crazy|wild|epic|win|rage|shock|wow)\b/i)?.[0] ||
        'WATCH'
    )?.toUpperCase() || 'WATCH'

  const captionClips = params.cues
    .slice(0, 70)
    .map((cue) => {
      const rawStart = Math.max(0, Math.min(duration - 0.2, cue.start))
      const rawLen = Math.max(0.7, Math.min(3.1, cue.end - cue.start))
      const fitted = fitClipInTimeline(rawStart, rawLen, duration, 0.25)
      const line = (cue.text?.trim() || 'CAPTION').toUpperCase().slice(0, 84)
      return {
        asset: {
          type: 'text',
          text: line,
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
        start: fitted.start,
        length: fitted.length,
        offset: { x: 0, y: safeZone.captionY },
        transition: { in: 'fadeFast', out: 'fadeFast' },
      }
    })
    .filter((clip) => clip.length >= 0.22)

  const hookClips = title
    ? (() => {
        const fitted = fitClipInTimeline(0, Math.min(2.4, duration), duration, 0.35)
        return [
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
                weight: 800,
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
            start: fitted.start,
            length: fitted.length,
            offset: { x: 0, y: 0.29 },
            transition: { in: 'slideUp', out: 'fadeFast' },
          },
        ]
      })()
    : []

  const badgeClips = score
    ? (() => {
        const fitted = fitClipInTimeline(0.35, Math.min(2.2, duration), duration, 0.35)
        return [
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
            start: fitted.start,
            length: fitted.length,
            offset: { x: 0.31, y: 0.31 },
            transition: { in: 'zoom', out: 'fadeFast' },
          },
        ]
      })()
    : []

  const sticker1 = (() => {
    const rawStart = Math.min(1.2, Math.max(0, duration - 1))
    const rawLen = Math.min(1.8, duration)
    const fitted = fitClipInTimeline(rawStart, rawLen, duration, 0.25)
    return {
      asset: {
        type: 'text',
        text: stickerText,
        width: 270,
        height: 110,
        font: {
          family: 'Montserrat ExtraBold',
          color: '#ffffff',
          size: 42,
          weight: 800,
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
      start: fitted.start,
      length: fitted.length,
      offset: { x: -0.31, y: 0.25 },
      transition: { in: 'zoom', out: 'fadeFast' },
    }
  })()

  const sticker2 =
    duration > 5
      ? (() => {
          const fitted = fitClipInTimeline(Math.max(2.8, duration * 0.38), 1.6, duration, 0.3)
          return {
            asset: {
              type: 'text',
              text: params.platform === 'youtube' ? 'SHORTS' : 'REELS',
              width: 270,
              height: 100,
              font: {
                family: 'Montserrat ExtraBold',
                color: '#000000',
                size: 36,
                weight: 800,
              },
              alignment: { horizontal: 'center', vertical: 'center' },
              background: {
                color: '#fff200',
                opacity: 0.78,
                padding: 8,
                borderRadius: 18,
              },
            },
            start: fitted.start,
            length: fitted.length,
            offset: { x: 0.31, y: -0.16 },
            transition: { in: 'slideUp', out: 'fadeFast' },
          }
        })()
      : null

  const stickerClips = sticker2 ? [sticker1, sticker2] : [sticker1]

  const ctaClip =
    duration >= 6
      ? (() => {
          const fitted = fitClipInTimeline(
            Math.max(0, duration - 2),
            Math.min(1.8, duration),
            duration,
            0.35
          )
          return [
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
              start: fitted.start,
              length: fitted.length,
              offset: { x: 0, y: 0.02 },
              transition: { in: 'slideUp', out: 'fade' },
            },
          ]
        })()
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
              length:
                typeof params.videoClipLengthSeconds === 'number' &&
                Number.isFinite(params.videoClipLengthSeconds) &&
                params.videoClipLengthSeconds > 0
                  ? Number(params.videoClipLengthSeconds.toFixed(2))
                  : 'auto',
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

/**
 * Fail fast with a clear message before POST — avoids opaque Shotstack 400s from NaN/empty fields.
 */
function validateShotstackRenderPayload(payload: { timeline: unknown; output: unknown }): string | null {
  const { timeline, output } = payload
  if (!timeline || typeof timeline !== 'object') return 'timeline is missing or not an object'
  if (!output || typeof output !== 'object') return 'output is missing or not an object'

  const out = output as Record<string, unknown>
  if (out.format !== 'mp4') return `output.format must be mp4, got ${String(out.format)}`
  const fps = out.fps
  if (typeof fps !== 'number' || !Number.isFinite(fps) || fps <= 0 || fps > 60) {
    return `output.fps must be a finite number in (0, 60], got ${String(fps)}`
  }
  const size = out.size
  if (!size || typeof size !== 'object') return 'output.size is missing'
  const sz = size as Record<string, unknown>
  const w = sz.width
  const h = sz.height
  if (typeof w !== 'number' || typeof h !== 'number' || !Number.isFinite(w) || !Number.isFinite(h)) {
    return `output.size width/height must be finite numbers, got width=${String(w)} height=${String(h)}`
  }
  if (w < 2 || h < 2 || w % 2 !== 0 || h % 2 !== 0) {
    return `output.size must be even dimensions ≥2, got ${w}x${h}`
  }

  const tl = timeline as { tracks?: unknown }
  if (!Array.isArray(tl.tracks) || tl.tracks.length === 0) {
    return 'timeline.tracks must be a non-empty array'
  }

  let clipIndex = 0
  for (let ti = 0; ti < tl.tracks.length; ti++) {
    const track = tl.tracks[ti]
    if (!track || typeof track !== 'object') return `timeline.tracks[${ti}] is not an object`
    const clips = (track as { clips?: unknown }).clips
    if (!Array.isArray(clips) || clips.length === 0) {
      return `timeline.tracks[${ti}].clips must be a non-empty array`
    }
    for (let ci = 0; ci < clips.length; ci++) {
      const clip = clips[ci]
      if (!clip || typeof clip !== 'object') {
        return `timeline.tracks[${ti}].clips[${ci}] is not an object`
      }
      const c = clip as Record<string, unknown>
      const start = c.start
      if (typeof start !== 'number' || !Number.isFinite(start) || start < 0) {
        return `clip[${clipIndex}] invalid start (track ${ti}, clip ${ci}): ${String(start)}`
      }
      const length = c.length
      const asset = c.asset
      if (!asset || typeof asset !== 'object') {
        return `clip[${clipIndex}] missing asset (track ${ti}, clip ${ci})`
      }
      const a = asset as Record<string, unknown>
      const type = a.type

      if (length === 'auto') {
        if (type !== 'video') {
          return `clip[${clipIndex}] length "auto" is only valid for video assets (track ${ti}, clip ${ci})`
        }
      } else if (typeof length !== 'number' || !Number.isFinite(length) || length <= 0) {
        return `clip[${clipIndex}] invalid length (track ${ti}, clip ${ci}): ${String(length)}`
      }

      if (type === 'video') {
        const src = a.src
        if (typeof src !== 'string' || !src.trim()) {
          return `clip[${clipIndex}] video asset missing or empty src (track ${ti}, clip ${ci})`
        }
      } else if (type === 'text') {
        const text = a.text
        if (typeof text !== 'string' || !text.trim()) {
          return `clip[${clipIndex}] text asset missing or empty text (track ${ti}, clip ${ci})`
        }
      } else {
        return `clip[${clipIndex}] unsupported asset type: ${String(type)}`
      }
      clipIndex++
    }
  }
  return null
}

async function submitShotstack(edit: Record<string, unknown>): Promise<string> {
  const apiKey = resolveShotstackApiKey()
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY is not configured')

  // Shotstack Edit POST only accepts documented root keys (timeline, output, merge, …).
  // Extra keys (e.g. our metadata bag) cause validation to fail with HTTP 400 "Bad Request".
  const timeline = edit.timeline
  const output = edit.output
  if (!timeline || typeof timeline !== 'object' || !output || typeof output !== 'object') {
    throw new Error('Shotstack edit is missing timeline or output')
  }
  const payload = { timeline, output }

  const preflight = validateShotstackRenderPayload(payload)
  if (preflight) {
    console.error('[clip-editor/vizard/caption] Shotstack payload failed local validation:', preflight)
    console.error('Shotstack request payload:', JSON.stringify(payload, null, 2))
    throw new Error(`Shotstack payload invalid: ${preflight}`)
  }

  let res: Response
  try {
    res = await fetch(`${shotstackEditApiRoot()}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[clip-editor/vizard/caption] Shotstack request failed (network)', err)
    console.error('Shotstack request payload:', JSON.stringify(payload, null, 2))
    const msg = err instanceof Error ? err.message : 'network error'
    throw new Error(`Shotstack request failed: ${msg}`)
  }

  const rawText = await res.text().catch(() => '')
  let data: unknown = {}
  try {
    data = rawText ? JSON.parse(rawText) : {}
  } catch {
    data = { message: rawText.slice(0, 500) }
  }
  if (!res.ok) {
    console.error('Shotstack request payload:', JSON.stringify(payload, null, 2))
    console.error('Shotstack raw response:', rawText)
    const detail = (shotstackSubmitUserMessage(data) + shotstackAuthEnvironmentHint(res.status)).trim()
    const suffix =
      rawText && (!detail || res.status === 400)
        ? rawText.replace(/\s+/g, ' ').trim().slice(0, 420)
        : rawText && !detail
          ? rawText.slice(0, 200)
          : ''
    const combined =
      detail && suffix && !detail.includes(suffix.slice(0, 40))
        ? `${detail} | body: ${suffix}`
        : detail || suffix || 'request failed'
    if (res.status === 400 || res.status === 422) {
      console.error('[clip-editor/vizard/caption] Shotstack render rejected', {
        status: res.status,
        detail,
        rawBody: rawText.replace(/\s+/g, ' ').trim().slice(0, 1600),
      })
    }
    throw new Error(`Shotstack (${res.status}): ${combined}`)
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
    const videoUrl = normalizeHttpMediaUrl(body.videoUrl)
    if (!videoUrl) {
      return NextResponse.json(
        {
          error:
            'videoUrl must be a valid http(s) URL. If Vizard returned a protocol-relative link, it is normalized server-side on the status endpoint — refresh the app or redeploy.',
        },
        { status: 400 }
      )
    }
    if (!body.platform || !isTargetPlatform(body.platform)) {
      return NextResponse.json(
        { error: "platform is required and must be one of: 'tiktok' | 'youtube' | 'reels'" },
        { status: 400 }
      )
    }

    const storageUser = user.username.replace(/^@/, '').toLowerCase()
    const staged = await stageVizardVideo({
      sourceUrl: videoUrl,
      storageUser,
    })

    const [transcript, probedDuration] = await Promise.all([
      transcribeVideo(staged.readUrl),
      probeShotstackSourceDurationSeconds(staged.readUrl),
    ])
    const cues = buildCaptionCues(transcript)
    if (!cues.length) throw new Error('Deepgram did not return caption timing for this Vizard clip')

    const msFromBody = coerceVideoMsDuration(body.videoMsDuration)
    const fromMetaSec = msFromBody != null && msFromBody > 0 ? msFromBody / 1000 : null
    const endFromCues = maxCueEndSeconds(cues) + 0.55
    const deepgramDuration = readDeepgramMediaDurationSeconds(transcript)
    const cueEndMax = maxCueEndSeconds(cues)
    const trustedProbe = trustedProbeDurationSeconds(probedDuration, cueEndMax)
    // Timeline must not exceed real media (Shotstack HTTP 400). Tightest bound wins: probe,
    // Deepgram-reported media length, client meta, then hard cap.
    let upper = 180
    if (trustedProbe != null) {
      upper = Math.min(upper, trustedProbe)
    }
    if (deepgramDuration != null) {
      upper = Math.min(upper, deepgramDuration + 0.45)
    }
    if (fromMetaSec != null && fromMetaSec > 0.05) {
      upper = Math.min(upper, fromMetaSec + 0.35)
    }
    let durationSeconds = Math.max(0.75, Math.min(upper, Math.max(endFromCues, 0.75)))
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      durationSeconds = Math.max(0.75, Math.min(180, endFromCues))
    }

    const cuesInRange = cues.filter(
      (c) => c.start < durationSeconds - 0.04 && c.end > c.start + 0.02
    )
    if (!cuesInRange.length) {
      throw new Error(
        'Caption cues fall outside the usable video duration after syncing to media length. Try again or omit videoMsDuration if it is incorrect.'
      )
    }

    const canPinVideoLength =
      trustedProbe != null ||
      (deepgramDuration != null && deepgramDuration > 0.05) ||
      (fromMetaSec != null && fromMetaSec > 0.05)

    const videoSrc = typeof staged.readUrl === 'string' ? staged.readUrl.trim() : ''
    if (!videoSrc) {
      throw new Error('Staged video URL is empty; cannot call Shotstack.')
    }

    const edit = buildShotstackCaptionEdit({
      videoUrl: videoSrc,
      platform: body.platform,
      durationSeconds,
      videoClipLengthSeconds: canPinVideoLength ? durationSeconds : null,
      cues: cuesInRange,
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
      sourceProbedDurationSeconds: probedDuration,
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[clip-editor/vizard/caption]', error)
    const message = error instanceof Error ? error.message : 'Vizard caption render failed'
    const shotstackRelated =
      message.startsWith('Shotstack') ||
      message.includes('Shotstack payload invalid') ||
      message.includes('SHOTSTACK_API_KEY')
    const clientError =
      shotstackRelated && !message.startsWith('Shotstack error:')
        ? `Shotstack error: ${message}`
        : message
    return NextResponse.json({ error: clientError, userMessage: clientError }, { status: 500 })
  }
}
