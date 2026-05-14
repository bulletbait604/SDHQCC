import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import {
  verifyAuth,
  hasClipEditorAccess,
  AuthError,
  createAuthErrorResponse,
} from '@/lib/auth/verifyAuth'
import {
  platformEditingDirective,
  platformSafeZoneOffsets,
  type TargetPlatform,
} from '@/lib/platformEditing'
import { applyStreamLadderStyleBlueprint, generateShotstackJSON } from '@/lib/generateShotstackJSON'
import { isCaptionFillerToken, stripCaptionDisplayFillers } from '@/lib/captionFillers'
import { generatePresignedReadUrl, getFileFromR2, getR2ObjectMetadata, putTextFileToR2 } from '@/lib/r2'
import { readAlgorithmSnapshotFromMongo } from '@/lib/algorithmSnapshotRead'
import {
  resolveClipEditorAlgorithmNotes,
  summarizeClipEditorAlgorithmSources,
} from '@/lib/clipEditorAlgorithmNotes'
import {
  deleteGeminiUploadedFile,
  pollGeminiFileUntilActive,
  uploadBufferToGeminiFilesApi,
} from '@/lib/geminiFiles'
import { resolveDeepgramApiKey } from '@/lib/clipEditorServerKeys'
import { clipEditorRenderBackend, submitVizardClip } from '@/lib/vizard'

export const dynamic = 'force-dynamic'

const MODEL_NAME = 'gemini-2.5-flash'
const GEMINI_EXTERNAL_URL_MAX_BYTES = 100 * 1024 * 1024
function isTargetPlatform(value: string): value is TargetPlatform {
  return value === 'tiktok' || value === 'youtube' || value === 'reels'
}

function isLayoutTemplate(value: string): value is LayoutTemplate {
  return (
    value === 'auto' ||
    value === 'fullFrame' ||
    value === 'stackedFacecam' ||
    value === 'pictureInPicture' ||
    value === 'splitScreen' ||
    value === 'focusCrop'
  )
}

function extractFirstJsonObject(raw: string): string | null {
  const s = raw.trim()
  const start = s.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (inString) {
      if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

type EditBlueprint = {
  cutSeconds?: number
  introHookSeconds?: number
  renderSeconds?: number
  captionWordsPerChunk?: number
  contentType?: 'gameplayStream' | 'talkingHead' | 'sportsAction' | 'screenShare' | 'unknown'
  layoutTemplate?: LayoutTemplate
  regions?: Partial<Record<'gameplay' | 'facecam' | 'speaker' | 'action', CropRegion>>
  richCaptionUrl?: string
  preferredTransitions?: string[]
  hookTitle?: string
  hookSubtitle?: string
  hookStyle?: 'pop' | 'glitch' | 'clean' | 'urgent'
  captionStyle?: 'karaoke' | 'bold' | 'clean'
  keywordHighlights?: string[]
  sourceMoments?: Array<{
    startSeconds?: number
    endSeconds?: number
    reason?: string
    visualTreatment?: 'none' | 'slowZoomIn' | 'slowZoomOut'
    role?: 'hook' | 'context' | 'escalation' | 'payoff' | 'proof' | 'loop'
    focusRegion?: 'gameplay' | 'facecam' | 'speaker' | 'action' | CropRegion
  }>
  textOverlays?: Array<{
    text?: string
    timelineStartSeconds?: number
    sourceStartSeconds?: number
    sourceMomentIndex?: number
    offsetSeconds?: number
    durationSeconds?: number
    position?: 'top' | 'middle' | 'bottom'
    type?: 'callout'
  }>
  stickerOverlays?: Array<{
    text?: string
    label?: string
    timelineStartSeconds?: number
    sourceMomentIndex?: number
    offsetSeconds?: number
    durationSeconds?: number
    position?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'middleLeft' | 'middleRight'
  }>
  ctaOverlay?: {
    text?: string
    timelineStartSeconds?: number
    durationSeconds?: number
    position?: 'top' | 'middle' | 'bottom'
    type?: 'callout'
  }
  subtitles?: Array<{
    text?: string
    timelineStartSeconds?: number
    sourceStartSeconds?: number
    sourceMomentIndex?: number
    offsetSeconds?: number
    durationSeconds?: number
    position?: 'bottom'
    type?: 'subtitle'
  }>
}

type ClipEditPlan = {
  captionText?: string
  hookPlan?: string
  pacePlan?: string
  facecamGuidance?: string
  shotstackEditPrompt?: string
  editBlueprint?: EditBlueprint
  publishPackage?: {
    tiktok?: { captionWithEmojisAndTags?: string }
    instagramReels?: { captionWithEmojisAndTags?: string }
    facebookReels?: { captionWithEmojisAndTags?: string }
    youtubeShorts?: { title?: string; description?: string; tags?: string[] }
  }
  viralityScore?: {
    overall?: number
    hook?: number
    flow?: number
    engagement?: number
    trendFit?: number
    notes?: string[]
  }
  aiProvidersUsed?: string[]
}

type TimedSubtitle = NonNullable<EditBlueprint['subtitles']>[number]
type LayoutTemplate = 'auto' | 'fullFrame' | 'stackedFacecam' | 'pictureInPicture' | 'splitScreen' | 'focusCrop'
type CropRegion = {
  x?: number
  y?: number
  width?: number
  height?: number
  label?: string
  confidence?: number
}
type DeepgramWord = {
  word?: string
  punctuated_word?: string
  start?: number
  end?: number
}
type DeepgramTranscription = {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string
        words?: DeepgramWord[]
      }>
    }>
  }
}

type TranscriptSegment = {
  start?: number
  end?: number
  text?: string
}

type TranscriptionResult = {
  subtitles: TimedSubtitle[]
  words: DeepgramWord[]
}

const SHOTSTACK_RENDERER_CONTRACT = `SHOTSTACK_RENDERER_CONTRACT:
- Behavioral target: emulate StreamLadder and OpusClip — hook-first montage, dense retention cuts, auto vertical reframing, speaker/gameplay-aware crops, punchy on-beat text, reaction badges, animated word-level captions when speech is clear (server adds these from transcript), and a short end CTA only if it does not step on the payoff.
- Output is a vertical 9:16 Shotstack edit (1080x1920).
- Renderer supports duplicate source video layers for StreamLadder-style layouts: fullFrame, stackedFacecam, pictureInPicture, splitScreen, and focusCrop.
- Renderer supports normalized crop regions for gameplay, facecam, speaker, and action. Region coordinates are objects: { "x": 0..1, "y": 0..1, "width": 0..1, "height": 0..1, "confidence": 0..1 }. x/y are top-left of the detected region in the original source frame.
- Renderer supports sourceMoments ordered in final edit order. Each sourceMoment uses original SOURCE timestamps.
- Renderer will target at least 8 seconds unless the uploaded source is shorter. Select enough sourceMoments to cover the requested renderSeconds.
- Renderer supports sourceMoment role: hook, context, escalation, payoff, proof, or loop.
- Renderer supports sourceMoment focusRegion: "gameplay", "facecam", "speaker", "action", or an inline normalized crop region.
- Renderer supports visualTreatment on sourceMoments: "slowZoomIn", "slowZoomOut", or "none". The first cut of each sourceMoment applies this zoom when set — use on hook, escalation, and payoff moments (not every beat).
- Renderer applies preferredTransitions between video micro-cuts when you list them (fade, fadeFast, slideUp, slideDown, slideLeft, slideRight, zoom, wipeLeft, wipeRight). Use 3-6 entries as a repeating pattern for a StreamLadder-like rhythm.
- Renderer supports an animated first-frame hook card via hookTitle, hookSubtitle, and hookStyle.
- Renderer supports timed textOverlays: max 8 callouts. Use sourceMomentIndex + offsetSeconds whenever possible so the text appears over that selected moment in the final cut.
- Renderer supports stickerOverlays as short text/emoji badge overlays, max 6.
- Renderer supports a ctaOverlay near the end of the clip.
- Renderer supports Shotstack rich captions from server-generated VTT when Deepgram word timing is available, with timed text subtitles as fallback.
- sourceMomentIndex is the 0-based index of the sourceMoments array AFTER your final ordering, not a source timestamp and not a timeline segment index.
- timelineStartSeconds means seconds in the FINAL rendered clip. sourceStartSeconds means seconds in the ORIGINAL uploaded source. Do not confuse them.
- Prefer sourceMomentIndex + offsetSeconds for every overlay/subtitle; only use timelineStartSeconds when you have computed the final rendered timeline position and it is inside the clip.
- Keep textOverlays readable: durationSeconds should usually be 1.6 to 3.0 seconds. Do not flash text for less than 1.5 seconds.
- keywordHighlights must list 3-12 words or short phrases that actually appear in spoken dialogue (for caption emphasis metadata). Do not invent keywords absent from speech.
- Unsupported requests in shotstackEditPrompt will be ignored for timeline features. Still write shotstackEditPrompt as a concise StreamLadder/Opus-style brief (pacing, energy, layout intent); the server uses it for pacing heuristics. Make the JSON fields authoritative for layout, moments, overlays, and transitions.
- If the source is a stream/game clip with both gameplay and facecam, prefer layoutTemplate "stackedFacecam" or "pictureInPicture" and provide gameplay/facecam regions.
- If the source is talking-head or sports/action without facecam, prefer "focusCrop" and provide speaker/action regions.
- Use "fullFrame" only when no reliable crop regions are detectable.`

async function refineClipEditPlan(params: {
  platform: TargetPlatform
  clipBrief: string
  sourceDurationSeconds?: number
  platformAlgorithmNotes: unknown
  geminiPlan: ClipEditPlan
}): Promise<ClipEditPlan> {
  const providersUsed = ['gemini-video']
  return { ...params.geminiPlan, aiProvidersUsed: providersUsed }
}

function parseGeminiClipPlan(raw: string): ClipEditPlan | null {
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const jsonSlice = extractFirstJsonObject(clean) || clean
  try {
    return JSON.parse(jsonSlice || '{}') as ClipEditPlan
  } catch (error) {
    console.warn('[process-clip] Gemini returned invalid JSON:', error)
    return null
  }
}

function buildFallbackClipPlan(platform: TargetPlatform, clipBrief: string): ClipEditPlan {
  const captionText = clipBrief.replace(/\s+/g, ' ').trim().slice(0, 120)
  return {
    captionText,
    hookPlan: 'Start on the strongest visible or spoken moment, then cut dead air and keep the pacing tight.',
    pacePlan: 'Use quick, readable cuts and let Shotstack build a simple source-driven edit if no timestamped plan is available.',
    facecamGuidance: 'Keep faces and key action centered inside the vertical safe zone.',
    shotstackEditPrompt: `StreamLadder/OpusClip-style ${platform} short: hook-led montage, jump-cut pacing, stacked facecam+gameplay when both exist, bold karaoke-style captions, reaction stickers on beats, and platform-safe 9:16 framing.`,
    editBlueprint: {
      cutSeconds: platform === 'youtube' ? 2.2 : platform === 'reels' ? 2.6 : 1.8,
      introHookSeconds: 2,
      renderSeconds: 14,
      captionWordsPerChunk: platform === 'youtube' ? 6 : 5,
      contentType: 'unknown',
      layoutTemplate: 'auto',
      regions: {},
      hookTitle: captionText || 'WATCH THIS',
      hookSubtitle: 'Best moment first',
      hookStyle: platform === 'reels' ? 'clean' : 'urgent',
      captionStyle: platform === 'reels' ? 'bold' : 'karaoke',
      keywordHighlights: [],
      preferredTransitions: ['fadeFast', 'slideUp', 'fadeFast', 'zoom'],
      textOverlays: [
        {
          text: captionText || 'Best part',
          timelineStartSeconds: 0.15,
          durationSeconds: 1.8,
          position: 'top',
          type: 'callout',
        },
      ],
      stickerOverlays: [
        {
          text: '!',
          timelineStartSeconds: 0.45,
          durationSeconds: 1.2,
          position: 'topRight',
        },
      ],
      ctaOverlay: {
        text: platform === 'youtube' ? 'Subscribe for more' : 'Follow for more',
        durationSeconds: 1.5,
        position: 'middle',
        type: 'callout',
      },
      subtitles: [],
    },
    viralityScore: {
      overall: 55,
      hook: 55,
      flow: 50,
      engagement: 55,
      trendFit: 50,
      notes: ['Fallback edit plan used because Gemini structured output was unavailable.'],
    },
    aiProvidersUsed: ['gemini-video-fallback'],
  }
}

function cleanSubtitleText(text: string | undefined): string | null {
  if (!text) return null
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,!?'"#@:-]/g, '')
    .trim()
  if (cleaned.length < 2) return null
  return cleaned
}

/** Spoken-content keywords for caption emphasis metadata (StreamLadder / Opus-style). */
function deriveKeywordHighlightsFromTranscript(words: DeepgramWord[], limit: number): string[] {
  const stop = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'is',
    'it',
    'that',
    'this',
    'these',
    'those',
    'i',
    'you',
    'we',
    'they',
    'he',
    'she',
    'was',
    'are',
    'were',
    'been',
    'be',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'just',
    'like',
    'so',
    'if',
    'as',
    'not',
    'no',
    'yes',
    'uh',
    'um',
    'oh',
    'okay',
    'ok',
    'yeah',
  ])
  const out: string[] = []
  const seen = new Set<string>()
  for (const w of words) {
    const raw = cleanSubtitleText(w.punctuated_word || w.word)
    if (!raw || raw.length < 3) continue
    const low = raw.toLowerCase()
    if (stop.has(low)) continue
    if (seen.has(low)) continue
    seen.add(low)
    out.push(raw)
    if (out.length >= limit) break
  }
  return out
}

function chunkTranscriptWords(text: string, maxWordsPerLine = 7): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += maxWordsPerLine) {
    chunks.push(words.slice(i, i + maxWordsPerLine).join(' '))
  }
  return chunks
}

function extractDeepgramSegments(transcript: DeepgramTranscription): TranscriptSegment[] {
  const words = extractDeepgramWords(transcript)
  const segments: TranscriptSegment[] = []
  let currentWords: string[] = []
  let currentStart: number | null = null
  let currentEnd: number | null = null

  for (const word of words) {
    const text = cleanSubtitleText(word.punctuated_word || word.word)
    const start = typeof word.start === 'number' && Number.isFinite(word.start) ? word.start : null
    const end = typeof word.end === 'number' && Number.isFinite(word.end) ? word.end : null
    if (!text || start == null || end == null || end <= start) continue

    if (currentStart == null) currentStart = start
    currentEnd = end
    currentWords.push(text)

    const endsSentence = /[.!?]$/.test(text)
    if (currentWords.length >= 5 || endsSentence) {
      const display = stripCaptionDisplayFillers(currentWords.join(' '))
      const line = cleanSubtitleText(display)
      if (line) {
        segments.push({
          start: currentStart,
          end: currentEnd,
          text: line,
        })
      }
      currentWords = []
      currentStart = null
      currentEnd = null
    }
  }

  if (currentWords.length && currentStart != null && currentEnd != null) {
    const display = stripCaptionDisplayFillers(currentWords.join(' '))
    const line = cleanSubtitleText(display)
    if (line) {
      segments.push({
        start: currentStart,
        end: currentEnd,
        text: line,
      })
    }
  }

  return segments
}

function extractDeepgramWords(transcript: DeepgramTranscription): DeepgramWord[] {
  return transcript.results?.channels?.[0]?.alternatives?.[0]?.words || []
}

function buildSubtitlesFromTranscript(segments: TranscriptSegment[]): TimedSubtitle[] {
  const subtitles: TimedSubtitle[] = []
  for (const segment of segments) {
    const text = cleanSubtitleText(stripCaptionDisplayFillers(segment.text ?? ''))
    const start = typeof segment.start === 'number' && Number.isFinite(segment.start) ? segment.start : null
    const end = typeof segment.end === 'number' && Number.isFinite(segment.end) ? segment.end : null
    if (!text || start == null || end == null || end <= start) continue

    const chunks = chunkTranscriptWords(text, 5)
    const segmentDuration = end - start
    const chunkDuration = Math.max(1.35, Math.min(3.2, segmentDuration / Math.max(1, chunks.length)))
    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index]
      const chunkText = cleanSubtitleText(chunk)
      if (!chunkText) continue
      subtitles.push({
        text: chunkText.slice(0, 84),
        sourceStartSeconds: Number((start + index * chunkDuration).toFixed(2)),
        durationSeconds: Number(chunkDuration.toFixed(2)),
        position: 'bottom',
        type: 'subtitle',
      })
      if (subtitles.length >= 48) return subtitles
    }
  }
  return subtitles
}

function mergeSubtitleTracks(transcriptSubtitles: TimedSubtitle[], plannedSubtitles: TimedSubtitle[] | undefined): TimedSubtitle[] {
  if (!transcriptSubtitles.length) return plannedSubtitles || []
  const merged: TimedSubtitle[] = [...transcriptSubtitles]
  for (const subtitle of plannedSubtitles || []) {
    if (merged.length >= 56) break
    if (!subtitle?.text) continue
    merged.push(subtitle)
  }
  return merged
}

type ResolvedSegment = {
  start: number
  length: number
  trim: number
}

function readResolvedSegments(shotstack: Record<string, unknown>): ResolvedSegment[] {
  const metadata = shotstack.metadata as Record<string, unknown> | undefined
  const raw = metadata?.resolvedSegments
  if (!Array.isArray(raw)) return []
  const segments: ResolvedSegment[] = []
  for (const item of raw) {
    const seg = item as Record<string, unknown>
    const start = typeof seg.start === 'number' && Number.isFinite(seg.start) ? seg.start : null
    const length = typeof seg.length === 'number' && Number.isFinite(seg.length) ? seg.length : null
    const trim = typeof seg.trim === 'number' && Number.isFinite(seg.trim) ? seg.trim : null
    if (start == null || length == null || trim == null || length <= 0) continue
    segments.push({ start, length, trim })
  }
  return segments
}

function mapSourceSecondToTimeline(sourceSecond: number, segments: ResolvedSegment[]): number | null {
  for (const segment of segments) {
    const sourceEnd = segment.trim + segment.length
    if (sourceSecond >= segment.trim && sourceSecond <= sourceEnd) {
      return segment.start + (sourceSecond - segment.trim)
    }
  }
  return null
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

function cleanVttCueText(text: string): string {
  const base = cleanSubtitleText(text)?.replace(/[<>]/g, '') || ''
  return stripCaptionDisplayFillers(base)
}

function buildTimelineCaptionVtt(words: DeepgramWord[], segments: ResolvedSegment[]): string | null {
  if (!words.length || !segments.length) return null
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
    const text = cleanVttCueText(cueWords.join(' '))
    if (text) cues.push({ start: cueStart, end: Math.max(cueStart + 0.52, cueEnd), text })
    cueWords = []
    cueStart = null
    cueEnd = null
  }

  for (const word of words) {
    const text = cleanSubtitleText(word.punctuated_word || word.word)
    const sourceStart = typeof word.start === 'number' && Number.isFinite(word.start) ? word.start : null
    const sourceEnd = typeof word.end === 'number' && Number.isFinite(word.end) ? word.end : null
    if (!text || sourceStart == null || sourceEnd == null || sourceEnd <= sourceStart) continue

    const timelineStart = mapSourceSecondToTimeline(sourceStart, segments)
    const timelineEnd = mapSourceSecondToTimeline(sourceEnd, segments)
    if (timelineStart == null || timelineEnd == null) {
      flush()
      continue
    }

    if (cueStart == null) cueStart = timelineStart
    const gap = cueEnd == null ? 0 : timelineStart - cueEnd
    if (cueWords.length >= 4 || gap > 0.32 || /[.!?]$/.test(cueWords[cueWords.length - 1] || '')) {
      flush()
      cueStart = timelineStart
    }

    if (isCaptionFillerToken(text)) continue

    cueWords.push(text)
    cueEnd = timelineEnd
    if (cues.length >= 80) break
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

async function uploadRichCaptionVtt(params: {
  storageUser: string
  words: DeepgramWord[]
  shotstack: Record<string, unknown>
}): Promise<string | null> {
  const vtt = buildTimelineCaptionVtt(params.words, readResolvedSegments(params.shotstack))
  if (!vtt) return null
  const key = `uploads/clips/${params.storageUser}/${Date.now()}-captions.vtt`
  const wrote = await putTextFileToR2(key, vtt, 'text/vtt; charset=utf-8')
  if (!wrote) return null
  return generatePresignedReadUrl(key, 86400)
}

async function transcribeClipSubtitles(params: {
  sourceUrl: string
}): Promise<TranscriptionResult> {
  const apiKey = resolveDeepgramApiKey()
  if (!apiKey) return { subtitles: [], words: [] }

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
    body: JSON.stringify({ url: params.sourceUrl }),
  })
  if (!res.ok) {
    throw new Error(`Deepgram transcription failed: ${res.status}`)
  }

  const transcript = (await res.json()) as DeepgramTranscription
  const words = extractDeepgramWords(transcript)
  return {
    subtitles: buildSubtitlesFromTranscript(extractDeepgramSegments(transcript)),
    words,
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!hasClipEditorAccess(user)) {
      return NextResponse.json({ error: 'Clip Editor requires the Editor badge.' }, { status: 403 })
    }
    const body = (await request.json()) as {
      platform?: string
      clipBrief?: string
      sourceUrl?: string
      r2FileKey?: string
      landscapeMode?: 'crop' | 'letterbox'
      layoutTemplate?: string
      sourceDurationSeconds?: number
      mimeType?: string
      fileName?: string
    }

    if (!body.platform || !isTargetPlatform(body.platform)) {
      return NextResponse.json(
        { error: "platform is required and must be one of: 'tiktok' | 'youtube' | 'reels'" },
        { status: 400 }
      )
    }
    if (!body.clipBrief || body.clipBrief.trim().length < 10) {
      return NextResponse.json({ error: 'clipBrief is required' }, { status: 400 })
    }
    const clipBrief = body.clipBrief.trim()
    const requestedLayout: LayoutTemplate =
      typeof body.layoutTemplate === 'string' && isLayoutTemplate(body.layoutTemplate)
        ? body.layoutTemplate
        : 'auto'
    const hasSourceUrl = typeof body.sourceUrl === 'string' && /^https?:\/\//i.test(body.sourceUrl)
    const hasR2FileKey = typeof body.r2FileKey === 'string' && body.r2FileKey.length > 0
    if (!hasSourceUrl && !hasR2FileKey) {
      return NextResponse.json(
        { error: 'Provide either sourceUrl (http/https) or r2FileKey from upload flow' },
        { status: 400 }
      )
    }

    const renderBackend = clipEditorRenderBackend()
    const platform = body.platform
    const safeZone = platformSafeZoneOffsets(platform)
    let sourceUrl = body.sourceUrl || ''
    let geminiFileUri = sourceUrl
    let effectiveMime = typeof body.mimeType === 'string' && body.mimeType ? body.mimeType : 'video/mp4'
    let cleanupGeminiName: string | null = null
    let r2KeyForGeminiFallback: string | null = null
    if (!sourceUrl && hasR2FileKey) {
      const storageUser = user.username.replace(/^@/, '').toLowerCase()
      const prefix = `uploads/clips/${storageUser}/`
      const key = body.r2FileKey!
      if (!key.startsWith(prefix) || key.includes('..') || key.length > 500) {
        return NextResponse.json({ error: 'Invalid r2FileKey for current user' }, { status: 400 })
      }
      r2KeyForGeminiFallback = key
      const meta = await getR2ObjectMetadata(key)
      if (!meta) {
        return NextResponse.json(
          { error: 'Could not read uploaded clip metadata' },
          { status: 404 }
        )
      }
      effectiveMime = meta.contentType || effectiveMime
      // Long TTL: Shotstack fetches this URL when the render runs (queue can be long); Gemini also uses it during planning.
      const readUrl = await generatePresignedReadUrl(key, 86400)
      if (!readUrl) {
        return NextResponse.json(
          { error: 'Could not prepare uploaded clip for processing' },
          { status: 503 }
        )
      }
      sourceUrl = readUrl
      geminiFileUri = readUrl

      if (renderBackend !== 'vizard' && meta.contentLength > GEMINI_EXTERNAL_URL_MAX_BYTES) {
        const apiKey = process.env.GEMINI_API
        if (!apiKey) {
          return NextResponse.json({ error: 'GEMINI_API is not configured' }, { status: 503 })
        }
        const buffer = await getFileFromR2(key)
        if (!buffer) {
          return NextResponse.json(
            { error: 'Could not load uploaded clip for Gemini analysis' },
            { status: 404 }
          )
        }
        const uploaded = await uploadBufferToGeminiFilesApi({
          apiKey,
          buffer,
          mimeType: effectiveMime,
          displayName: typeof body.fileName === 'string' ? body.fileName : 'clip.mp4',
        })
        cleanupGeminiName = uploaded.name
        await pollGeminiFileUntilActive(apiKey, uploaded.uri)
        geminiFileUri = uploaded.uri
      }
    }

    if (renderBackend === 'vizard') {
      const vizard = await submitVizardClip({
        sourceUrl,
        platform,
        fileName: body.fileName,
        mimeType: effectiveMime,
        projectName: `SDHQ ${platform} Vizard clip`,
      })

      return NextResponse.json({
        platform,
        model: 'vizard',
        renderer: 'vizard',
        aiProvidersUsed: ['vizard'],
        vizard: {
          projectId: String(vizard.projectId),
          shareLink: vizard.shareLink || null,
        },
        source: hasR2FileKey ? 'r2-presigned-url' : 'source-url',
      })
    }

    const apiKey = process.env.GEMINI_API
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API is not configured' }, { status: 503 })
    }
    const snapshot = await readAlgorithmSnapshotFromMongo()
    const platformAlgorithmNotes = resolveClipEditorAlgorithmNotes(snapshot, platform)
    const gemini = new GoogleGenAI({ apiKey })

    try {
      const createGeminiRequest = () => ({
        model: MODEL_NAME,
        config: {
          responseMimeType: 'application/json',
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  mimeType: effectiveMime,
                  fileUri: geminiFileUri,
                },
              },
              {
                text: `You are the "Viral Architect" engine. Build an upload-click-done package for a short-form video.
Target platform: ${platform}
Platform directive: ${platformEditingDirective(platform)}
Platform safe-zone offsets: ${JSON.stringify(safeZone)}
Clip-editor algorithm context (JSON): ${JSON.stringify(platformAlgorithmNotes)}
Source duration seconds: ${typeof body.sourceDurationSeconds === 'number' ? body.sourceDurationSeconds : 'unknown'}
Requested layout preference: ${requestedLayout}

${SHOTSTACK_RENDERER_CONTRACT}

Return valid JSON only:
{
  "captionText": "string (on-video caption)",
  "hookPlan": "string",
  "pacePlan": "string",
  "facecamGuidance": "string",
  "shotstackEditPrompt": "string (StreamLadder/OpusClip-style brief: pacing, cut energy, layout intent, caption tone; mention streamladder or opusclip for tighter default cuts)",
  "editBlueprint": {
    "cutSeconds": "number 1.0..4.5",
    "introHookSeconds": "number 1.0..5.0",
    "renderSeconds": "number 8..45",
    "captionWordsPerChunk": "number 3..14",
    "contentType": "gameplayStream|talkingHead|sportsAction|screenShare|unknown",
    "layoutTemplate": "auto|fullFrame|stackedFacecam|pictureInPicture|splitScreen|focusCrop",
    "regions": {
      "gameplay": { "x": "number 0..1", "y": "number 0..1", "width": "number 0..1", "height": "number 0..1", "label": "optional string", "confidence": "number 0..1" },
      "facecam": { "x": "number 0..1", "y": "number 0..1", "width": "number 0..1", "height": "number 0..1", "label": "optional string", "confidence": "number 0..1" },
      "speaker": { "x": "number 0..1", "y": "number 0..1", "width": "number 0..1", "height": "number 0..1", "label": "optional string", "confidence": "number 0..1" },
      "action": { "x": "number 0..1", "y": "number 0..1", "width": "number 0..1", "height": "number 0..1", "label": "optional string", "confidence": "number 0..1" }
    },
    "hookTitle": "short scroll-stopping title, max 8 words",
    "hookSubtitle": "optional supporting hook line, max 10 words",
    "hookStyle": "pop|glitch|clean|urgent",
    "captionStyle": "karaoke|bold|clean",
    "keywordHighlights": ["3-12 words that are actually spoken in the clip, for caption emphasis"],
    "preferredTransitions": ["fadeFast", "slideUp", "fadeFast", "zoom"],
    "sourceMoments": [
      { "startSeconds": "number", "endSeconds": "number", "role": "hook|context|escalation|payoff|proof|loop", "focusRegion": "gameplay|facecam|speaker|action", "reason": "why this exact moment should be used", "visualTreatment": "none|slowZoomIn|slowZoomOut" }
    ],
    "textOverlays": [
      { "text": "short grounded callout from visible/spoken clip content", "sourceMomentIndex": "number 0-based", "offsetSeconds": "number within that selected moment", "timelineStartSeconds": "optional number in final render timeline", "durationSeconds": "number 1.6..3.0", "position": "top|middle|bottom", "type": "callout" }
    ],
    "stickerOverlays": [
      { "text": "short emoji/badge text like OMG, W, CLUTCH, FAIL, or !", "sourceMomentIndex": "number 0-based", "offsetSeconds": "number within that selected moment", "timelineStartSeconds": "optional number in final render timeline", "durationSeconds": "number 0.9..2.4", "position": "topLeft|topRight|bottomLeft|bottomRight|middleLeft|middleRight" }
    ],
    "ctaOverlay": {
      "text": "short CTA grounded to platform, e.g. Follow for more",
      "durationSeconds": "number 1.2..2.5",
      "position": "top|middle|bottom",
      "type": "callout"
    },
    "subtitles": [
      { "text": "short spoken line from the clip", "sourceMomentIndex": "number 0-based", "offsetSeconds": "number within that selected moment", "timelineStartSeconds": "optional number in final render timeline", "durationSeconds": "number 1.4..3.2", "position": "bottom", "type": "subtitle" }
    ]
  },
  "viralityScore": {
    "overall": "number 0..100",
    "hook": "number 0..100",
    "flow": "number 0..100",
    "engagement": "number 0..100",
    "trendFit": "number 0..100",
    "notes": ["short reason"]
  },
  "publishPackage": {
    "tiktok": {
      "captionWithEmojisAndTags": "string with emojis and hashtags"
    },
    "instagramReels": {
      "captionWithEmojisAndTags": "string with emojis and hashtags"
    },
    "facebookReels": {
      "captionWithEmojisAndTags": "string with emojis and hashtags"
    },
    "youtubeShorts": {
      "title": "string",
      "description": "string with emojis",
      "tags": ["string"]
    }
  }
}

Rules:
- Analyze the supplied video file directly. Do not create a generic edit plan from the text brief alone.
- Build this like a viral human editor using a StreamLadder/OpusClip style workflow: find the strongest hook, cut dead air, preserve context, escalate, deliver payoff, then optionally end on a loopable beat.
- Match StreamLadder/OpusClip density: aim for many short contiguous trims inside each sourceMoment (the renderer will micro-cut to hit cutSeconds), so choose moments with continuous energy rather than one long static shot unless that shot is the payoff.
- Opus-style information hierarchy: (1) first-frame hook title answers "why watch", (2) optional hook subtitle adds specificity, (3) 2-6 grounded callouts explain beats, (4) stickers mark reactions/outcomes, (5) captions/subtitles carry speech — never duplicate the same sentence as both a giant callout and a subtitle at the same timestamp.
- First 0-2 seconds: start on the highest-retention source moment. It can be a reaction, impact frame, surprising line, visible outcome, or conflict point. Do not start with setup unless setup itself is compelling.
- Pick 3-8 sourceMoments from the strongest visual/audio moments in the actual clip. Order them in FINAL EDIT ORDER, not chronological order, with the best hook first.
- Select enough sourceMoments to make the final edit feel complete: usually 10-18 seconds total for a normal uploaded clip, never 1-3 seconds unless the source video is only that long.
- For each sourceMoment, use exact original source timestamps, role, focusRegion, a reason tied to what is seen/heard, and visualTreatment.
- Every selected moment must serve one role: hook, context, escalation, punchline/payoff, proof, or loop.
- Remove dead air, menus, loading screens, long pauses, repeated frames, streamer silence, and context that does not raise retention.
- Use visualTreatment on the hook moment and 1-2 other peak beats (payoff or escalation): slowZoomIn on impact/reaction faces or narrow gameplay; slowZoomOut when revealing wider context. Use none on routine context. At most 4 sourceMoments with non-none visualTreatment.
- Detect reusable layout regions in normalized source-frame coordinates. For stream clips, provide gameplay and facecam boxes if both exist. For talking-head clips, provide speaker. For sports/action clips, provide action.
- Honor Requested layout preference unless it clearly does not fit the detected source. If requested layout is auto, choose the strongest layout: stackedFacecam for gameplay + facecam, pictureInPicture for gameplay + reaction, focusCrop for talking-head/sports/action, fullFrame only when regions are unreliable.
- hookTitle must be a strong first-frame scroll-stopper based on what actually happens in the clip. Avoid generic clickbait if it is not supported by the clip.
- textOverlays must be grounded in visible/spoken clip content and timed to the relevant selected moment. Use 3-7 total when the clip has enough beats (fewer only if the source is very short or sparse). Do not invent unrelated text.
- stickerOverlays should behave like StreamLadder/OpusClip reaction badges: short, punchy, timed to action/reaction moments. Use 2-6 total when content supports it. Use plain labels if emoji is not needed.
- ctaOverlay should appear near the end only if it does not cover the payoff.
- captionStyle should be karaoke for TikTok/high-energy clips, bold for Shorts, clean/bold for Reels.
- subtitles must be short spoken lines from the clip. Use [] if speech is unclear.
- CRITICAL TIMING: sourceMoments use original source timestamps. textOverlays/subtitles should use sourceMomentIndex + offsetSeconds, or timelineStartSeconds in the final rendered clip. Do not put original source timestamps in timelineStartSeconds.
- sourceMomentIndex is the 0-based index of your final ordered sourceMoments array. If sourceMoments[0] is the hook, sourceMomentIndex 0 means text appears during that hook in the final rendered clip.
- Do not place overlays/subtitles after the last useful cut. Every text clip must appear while its relevant selected sourceMoment is visible.
- Avoid generic overlays like "Wait for it", "You won't believe this", "Epic moment", unless that phrase is actually spoken/visible or specifically true for the clip.
- Prefer a hookTitle plus 1 strong callout or sticker in the first 1.5 seconds if it clarifies the hook.
- Make text readable. Callouts should stay on screen about 1.6-3.0 seconds; subtitles about 1.4-3.2 seconds.
- For gameplay/stream clips: prioritize kills, fails, clutch moments, rage/reaction, chat-worthy lines, visual outcome, scoreboard/proof, or sudden reversal.
- For talking clips: prioritize bold claim, contradiction, actionable takeaway, emotional reaction, or concise quote.
- Optimize by platform:
  - TikTok: fastest hook, dense cuts, visible payoff, punchy captions, no slow intro.
  - YouTube Shorts: immediate clarity, title/description strong SEO, loop ending when possible.
  - Reels: cleaner pacing, fewer but better callouts, visually polished framing.
- Final video is always 9:16 vertical (1080×1920). Sources may be landscape or webcam; the editor reframes to vertical (center-crop to fill by default, or letterbox the full wide frame if the user requests it). Keep faces and key action in the safe caption zone.
- Use every available source in the clip-editor algorithm context. For Reels, blend Instagram Reels and Facebook Reels advice; for YouTube, prioritize Shorts while borrowing applicable long-form retention/title lessons.
- If target platform is reels, still provide Instagram + Facebook Reels variants.
- If target platform is tiktok, still provide TikTok + Reels + Shorts variants.
- If target platform is youtube, prioritize Shorts fields quality and keep title under 70 chars.
- Include at least 8 hashtags for TikTok/Reels captions.
- Keep YouTube Shorts tags array between 10 and 20 items.
- Score the clip with viralityScore using OpusClip-like dimensions: hook, flow, engagement, and trend fit.
- Always set preferredTransitions to 4-6 Shotstack ids (repeat pattern): fade, fadeFast, slideUp, slideDown, slideLeft, slideRight, zoom, wipeLeft, wipeRight — tuned to platform (faster/choppier for TikTok, slightly softer for Reels).
- Make the editBlueprint concrete: specify cut cadence, hook title/style, caption style, source moments, selective zooms, preferredTransitions, grounded callouts, sticker badges, CTA, subtitles, and platform pacing aligned with the platform directive and algorithm notes.

CLIP_BRIEF:
${clipBrief}`,
              },
            ],
          },
        ],
      })

      let response
      try {
        response = await gemini.models.generateContent(createGeminiRequest())
      } catch (geminiError) {
        if (!r2KeyForGeminiFallback || cleanupGeminiName) {
          throw geminiError
        }

        console.warn(
          '[process-clip] Presigned URL analysis failed; retrying via Gemini Files API:',
          geminiError instanceof Error ? geminiError.message : geminiError
        )
        const buffer = await getFileFromR2(r2KeyForGeminiFallback)
        if (!buffer) {
          return NextResponse.json(
            { error: 'Could not load uploaded clip for Gemini analysis' },
            { status: 404 }
          )
        }
        const uploaded = await uploadBufferToGeminiFilesApi({
          apiKey,
          buffer,
          mimeType: effectiveMime,
          displayName: typeof body.fileName === 'string' ? body.fileName : 'clip.mp4',
        })
        cleanupGeminiName = uploaded.name
        await pollGeminiFileUntilActive(apiKey, uploaded.uri)
        geminiFileUri = uploaded.uri
        response = await gemini.models.generateContent(createGeminiRequest())
      }

    const raw = typeof response.text === 'string' ? response.text : ''
    const geminiPlan = parseGeminiClipPlan(raw) || buildFallbackClipPlan(platform, clipBrief)
    const sourceDurationSeconds =
      typeof body.sourceDurationSeconds === 'number' && Number.isFinite(body.sourceDurationSeconds)
        ? body.sourceDurationSeconds
        : undefined
    const parsed = await refineClipEditPlan({
      platform,
      clipBrief,
      sourceDurationSeconds,
      platformAlgorithmNotes,
      geminiPlan,
    })

    const captionForVideo =
      (parsed.captionText && parsed.captionText.trim()) ||
      (parsed.hookPlan && parsed.hookPlan.trim()) ||
      ''

    const transcription = await transcribeClipSubtitles({
      sourceUrl,
    }).catch((error) => {
      console.warn('[process-clip] Deepgram subtitle transcription failed:', error)
      return { subtitles: [], words: [] } as TranscriptionResult
    })
    const transcriptSubtitles = transcription.subtitles
    const aiProvidersUsed = parsed.aiProvidersUsed || ['gemini-video']
    if (transcriptSubtitles.length) aiProvidersUsed.push('deepgram-transcription')

    const lm = body.landscapeMode === 'letterbox' ? 'letterbox' : 'crop'
    const editBlueprint: EditBlueprint | undefined =
      parsed.editBlueprint || transcriptSubtitles.length
        ? {
            ...(parsed.editBlueprint || {}),
            layoutTemplate:
              requestedLayout === 'auto'
                ? parsed.editBlueprint?.layoutTemplate || 'auto'
                : requestedLayout,
            subtitles: mergeSubtitleTracks(transcriptSubtitles, parsed.editBlueprint?.subtitles),
          }
        : undefined
    const enhancedPlan: ClipEditPlan = {
      ...parsed,
      aiProvidersUsed,
      editBlueprint,
    }

    if (editBlueprint) {
      const normalized = applyStreamLadderStyleBlueprint(platform, sourceDurationSeconds, editBlueprint)
      if (normalized) Object.assign(editBlueprint, normalized)
    }
    if (editBlueprint && transcription.words.length) {
      const autoKw = deriveKeywordHighlightsFromTranscript(transcription.words, 10)
      const existing = (editBlueprint.keywordHighlights || []).map((k) => String(k).trim()).filter(Boolean)
      const merged = Array.from(new Set([...existing, ...autoKw])).slice(0, 14)
      if (merged.length) editBlueprint.keywordHighlights = merged
    }

    let shotstack = generateShotstackJSON({
      title: `Viral Architect ${platform}`,
      sourceUrl,
      platform,
      captionText: captionForVideo || undefined,
      safeZone,
      shotstackEditPrompt: enhancedPlan.shotstackEditPrompt,
      hookPlan: enhancedPlan.hookPlan,
      pacePlan: enhancedPlan.pacePlan,
      landscapeMode: lm,
      editBlueprint,
      transcriptWords: transcription.words,
      sourceDurationSeconds,
    })

    if (transcription.words.length && editBlueprint) {
      const storageUser = user.username.replace(/^@/, '').toLowerCase()
      const richCaptionUrl = await uploadRichCaptionVtt({
        storageUser,
        words: transcription.words,
        shotstack,
      }).catch((error) => {
        console.warn('[process-clip] Rich caption VTT upload failed:', error)
        return null
      })
      if (richCaptionUrl) {
        editBlueprint.richCaptionUrl = richCaptionUrl
        enhancedPlan.editBlueprint = editBlueprint
        aiProvidersUsed.push('shotstack-rich-captions')
        shotstack = generateShotstackJSON({
          title: `Viral Architect ${platform}`,
          sourceUrl,
          platform,
          captionText: captionForVideo || undefined,
          safeZone,
          shotstackEditPrompt: enhancedPlan.shotstackEditPrompt,
          hookPlan: enhancedPlan.hookPlan,
          pacePlan: enhancedPlan.pacePlan,
          landscapeMode: lm,
          editBlueprint,
          transcriptWords: transcription.words,
          sourceDurationSeconds,
        })
      }
    }

    return NextResponse.json({
      platform,
      model: MODEL_NAME,
      aiProvidersUsed,
      safeZone,
      analysis: enhancedPlan,
      shotstackEditPrompt:
        enhancedPlan.shotstackEditPrompt ||
        `${enhancedPlan.hookPlan || ''} ${enhancedPlan.pacePlan || ''} ${enhancedPlan.facecamGuidance || ''}`.trim(),
      editBlueprint: editBlueprint || null,
      publishPackage: enhancedPlan.publishPackage || null,
      algorithmContext: summarizeClipEditorAlgorithmSources(platformAlgorithmNotes),
      shotstack,
      refineWithVizard: renderBackend === 'shotstack-then-vizard',
      source: hasR2FileKey ? 'r2-presigned-url' : 'source-url',
    })
    } finally {
      if (cleanupGeminiName) {
        await deleteGeminiUploadedFile(apiKey, cleanupGeminiName).catch((e) =>
          console.warn('[process-clip] Gemini temp file cleanup:', e)
        )
      }
    }
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[process-clip]', error)
    const message = error instanceof Error ? error.message : 'process-clip failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
