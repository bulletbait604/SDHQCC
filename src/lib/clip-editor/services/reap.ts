/**
 * Reap Video Automation API client.
 * Docs: https://docs.reap.video/api-reference/1_introduction
 * Base: https://public.reap.video/api/v1/automation/
 */
import { resolveReapApiKey } from '@/lib/clipEditorServerKeys'
import { normalizeHttpMediaUrl } from '@/lib/normalizeMediaUrl'
import type { ClipEditorPlatform, ClipLayoutTemplate } from '@/lib/clip-editor/types'

const REAP_BASE = 'https://public.reap.video/api/v1/automation'

export type ReapGenre = 'talking' | 'screenshare' | 'gaming'
export type ReapOrientation = 'landscape' | 'portrait' | 'square'
export type ReapProjectType = 'clipping' | 'captions' | 'reframe' | 'dubbing' | 'transcription'
export type ReapProjectStatus =
  | 'queued'
  | 'prepped'
  | 'draft'
  | 'processing'
  | 'finalizing'
  | 'completed'
  | 'invalid'
  | 'expired'
  | 'failed'
  | 'error'

export type ReapUploadUrlResponse = {
  uploadUrl: string
  id: string
  fileName?: string
  fileType?: string
  status?: string
}

export type ReapProject = {
  id: string
  title?: string
  status?: ReapProjectStatus | string
  projectType?: ReapProjectType | string
  billedDuration?: number
  thumbnail?: string
}

export type ReapClip = {
  id: string
  projectId?: string
  clipUrl?: string | null
  clipWithCaptionsUrl?: string | null
  startTime?: number
  endTime?: number
  duration?: number
  topic?: string | null
  title?: string | null
  caption?: string | null
  viralityScore?: number | null
  exportOrientation?: ReapOrientation
  enableCaptions?: boolean
  enableEmojis?: boolean
  enableHighlights?: boolean
}

export type ReapClipsResponse = {
  clips?: ReapClip[]
  totalClips?: number
  currentPage?: number
  totalPages?: number
}

export type ReapViralEditOptions = {
  platform: ClipEditorPlatform
  layoutTemplate: ClipLayoutTemplate
  landscapeMode: 'crop' | 'letterbox'
  genre?: ReapGenre
  captionsPreset?: string
  enableEmojis?: boolean
  enableHighlights?: boolean
  prompt?: string
  language?: string
  durationSeconds?: number
  fileName?: string
  mimeType?: string
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

function requireApiKey(): string {
  const key = resolveReapApiKey()
  if (!key) throw new Error('REAP_API is not configured on this server')
  return key
}

async function reapJson<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | undefined> }
): Promise<T> {
  const apiKey = requireApiKey()
  const url = new URL(`${REAP_BASE}${path}`)
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    }
  }
  const { query: _q, ...rest } = init || {}
  const res = await fetch(url.toString(), {
    ...rest,
    headers: {
      ...authHeaders(apiKey),
      ...(rest.headers || {}),
    },
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as T & { detail?: string | unknown }
  if (!res.ok) {
    const detail =
      typeof data.detail === 'string'
        ? data.detail
        : data.detail != null
          ? JSON.stringify(data.detail)
          : `Reap API error (${res.status})`
    throw new Error(detail)
  }
  return data
}

export function isReapConfigured(): boolean {
  return Boolean(resolveReapApiKey())
}

/** Map Clip Editor layout → Reap genre for AI framing. */
export function layoutToReapGenre(layout: ClipLayoutTemplate, explicit?: ReapGenre): ReapGenre {
  if (explicit) return explicit
  switch (layout) {
    case 'stackedFacecam':
    case 'pictureInPicture':
    case 'splitScreen':
      return 'screenshare'
    case 'focusCrop':
    case 'fullFrame':
    case 'auto':
    default:
      return 'talking'
  }
}

export function platformToReapOrientation(
  platform: ClipEditorPlatform,
  landscapeMode: 'crop' | 'letterbox'
): ReapOrientation {
  if (landscapeMode === 'letterbox') return 'landscape'
  if (platform === 'youtube') return 'portrait'
  return 'portrait'
}

export function buildViralClipPrompt(params: {
  platform: ClipEditorPlatform
  layoutTemplate: ClipLayoutTemplate
  prompt?: string
}): string {
  const custom = params.prompt?.trim()
  if (custom) return custom.slice(0, 1000)

  const platformHint =
    params.platform === 'tiktok'
      ? 'TikTok — punchy hook in first 1s, high energy'
      : params.platform === 'reels'
        ? 'Instagram Reels — clean hook, scroll-stopping pacing'
        : 'YouTube Shorts — clear payoff, retain to the end'

  const layoutHint =
    params.layoutTemplate === 'stackedFacecam'
      ? 'Prefer facecam + gameplay stacked framing.'
      : params.layoutTemplate === 'pictureInPicture'
        ? 'Prefer gameplay with facecam PiP.'
        : params.layoutTemplate === 'splitScreen'
          ? 'Prefer split framing when two subjects matter.'
          : params.layoutTemplate === 'focusCrop'
            ? 'Tight face/action tracking crop.'
            : 'Pick the most engaging moments automatically.'

  return (
    `Create viral short-form clips for ${platformHint}. ${layoutHint} ` +
    `Aggressively remove silence, pauses, filler words, and dead air — never return near-full-length copies of the source. ` +
    `Prefer 15–45 second clips with a hard hook in the first second, punchy jump cuts, and only the highest-energy moments. ` +
    `Skip intros, outros, rambling, and low-energy stretches. Trailer-style pacing.`
  ).slice(0, 1000)
}

export async function getReapUploadUrl(filename: string): Promise<ReapUploadUrlResponse> {
  const safe = filename.toLowerCase().endsWith('.mov')
    ? filename
    : filename.toLowerCase().endsWith('.mp4')
      ? filename
      : `${filename.replace(/\.[^.]+$/, '') || 'clip'}.mp4`
  return reapJson<ReapUploadUrlResponse>('/get-upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename: safe }),
  })
}

export async function putVideoToReapUploadUrl(params: {
  uploadUrl: string
  body: ArrayBuffer | Buffer | Blob
  contentType?: string
}): Promise<void> {
  const res = await fetch(params.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': params.contentType || 'video/mp4',
    },
    body: params.body as BodyInit,
  })
  if (!res.ok) {
    throw new Error(`Reap file upload failed (${res.status})`)
  }
}

/** Download from R2/source URL and upload into Reap; returns uploadId. */
export async function uploadSourceUrlToReap(params: {
  sourceUrl: string
  fileName?: string
  mimeType?: string
}): Promise<{ uploadId: string }> {
  const res = await fetch(params.sourceUrl)
  if (!res.ok) throw new Error(`Could not download source for Reap (${res.status})`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.byteLength < 1000) throw new Error('Source video too small to upload to Reap')

  const fileName = params.fileName?.trim() || `clip-${Date.now()}.mp4`
  const upload = await getReapUploadUrl(fileName)
  await putVideoToReapUploadUrl({
    uploadUrl: upload.uploadUrl,
    body: buffer,
    contentType: params.mimeType || 'video/mp4',
  })
  return { uploadId: upload.id }
}

export async function createReapClips(body: {
  uploadId: string
  /** Always false on Creator — AI reframe / create-reframe is Studio-only. */
  reframeClips?: boolean
  exportOrientation?: ReapOrientation
  /** Creator plan max is 1080. */
  exportResolution?: 720 | 1080
  captionsPreset?: string | null
  enableEmojis?: boolean
  enableHighlights?: boolean
  language?: string | null
  genre?: ReapGenre
  clipDurations?: number[][]
  topics?: string[]
  prompt?: string
  selectedStart?: number | null
  selectedEnd?: number | null
}): Promise<ReapProject> {
  return reapJson<ReapProject>('/create-clips', {
    method: 'POST',
    body: JSON.stringify({
      ...body,
      reframeClips: false,
      exportResolution: body.exportResolution === 720 ? 720 : 1080,
    }),
  })
}

export async function createReapCaptions(body: {
  uploadId?: string
  sourceUrl?: string
  captionsPreset?: string | null
  language?: string | null
  enableEmojis?: boolean
  enableHighlights?: boolean
  /** Creator plan max is 1080. */
  resolution?: 720 | 1080
  transcriptionScript?: 'native' | 'roman'
}): Promise<ReapProject> {
  return reapJson<ReapProject>('/create-captions', {
    method: 'POST',
    body: JSON.stringify({
      ...body,
      resolution: body.resolution === 720 ? 720 : 1080,
    }),
  })
}

export async function getReapProjectStatus(projectId: string): Promise<{
  projectId: string
  projectType?: string
  source?: string
  status: string
}> {
  return reapJson('/get-project-status', {
    method: 'GET',
    query: { projectId },
  })
}

export async function getReapProjectClips(
  projectId: string,
  page = 1,
  pageSize = 20
): Promise<ReapClipsResponse> {
  return reapJson<ReapClipsResponse>('/get-project-clips', {
    method: 'GET',
    query: { projectId, page, pageSize },
  })
}

export function reapClipPlaybackUrl(clip: ReapClip | null | undefined): string | null {
  if (!clip) return null
  return normalizeHttpMediaUrl(clip.clipUrl) || normalizeHttpMediaUrl(clip.clipWithCaptionsUrl)
}

export function pickBestReapClip(clips: ReapClip[] | undefined): ReapClip | null {
  if (!clips?.length) return null
  const playable = clips.filter((c) => Boolean(reapClipPlaybackUrl(c)))
  if (!playable.length) return null
  return [...playable].sort((a, b) => {
    const scoreDiff = (Number(b.viralityScore) || 0) - (Number(a.viralityScore) || 0)
    // Prefer a tighter edit when virality is close — avoid near-full-length dumps.
    if (Math.abs(scoreDiff) >= 0.75) return scoreDiff
    return (Number(a.duration) || 999) - (Number(b.duration) || 999)
  })[0]
}

export function isReapTerminalStatus(status: string | undefined): boolean {
  const s = (status || '').toLowerCase()
  return s === 'completed' || s === 'invalid' || s === 'expired' || s === 'failed' || s === 'error'
}

export function isReapSuccessStatus(status: string | undefined): boolean {
  return (status || '').toLowerCase() === 'completed'
}

/**
 * Reap AI clipping (`create-clips`) requires source videos ≥2 minutes.
 * Captions-only does not cut dead air — do not use it as a clipping substitute.
 */
export const REAP_CLIPPING_MIN_SECONDS = 120

export function canUseReapAiClipping(durationSeconds: number | undefined): boolean {
  return (
    typeof durationSeconds === 'number' &&
    Number.isFinite(durationSeconds) &&
    durationSeconds >= REAP_CLIPPING_MIN_SECONDS
  )
}

/**
 * Start Creator-plan Reap AI clipping. Throws if the source is under 2 minutes —
 * Reap will reject shorter files, and captions-only would keep nearly full length.
 */
export async function startReapViralProject(
  sourceUrl: string,
  options: ReapViralEditOptions
): Promise<{
  projectId: string
  uploadId: string
  mode: 'clipping'
}> {
  const duration = options.durationSeconds ?? 0
  if (!canUseReapAiClipping(duration)) {
    throw new Error(
      `Reap AI clipping needs a source of at least ${REAP_CLIPPING_MIN_SECONDS} seconds (you sent ${Math.round(duration)}s). ` +
        `Upload a longer VOD/stream segment — Captions-only cannot cut dead air, and Studio does not unlock short-clip AI cutting via API.`
    )
  }

  const genre = layoutToReapGenre(options.layoutTemplate, options.genre)
  const orientation = platformToReapOrientation(options.platform, options.landscapeMode)
  const captionsPreset = options.captionsPreset?.trim() || 'system_beasty'
  const enableEmojis = options.enableEmojis !== false
  const enableHighlights = options.enableHighlights !== false

  const { uploadId } = await uploadSourceUrlToReap({
    sourceUrl,
    fileName: options.fileName,
    mimeType: options.mimeType,
  })

  const project = await createReapClips({
    uploadId,
    reframeClips: false,
    exportOrientation: orientation,
    exportResolution: 1080,
    captionsPreset,
    enableEmojis,
    enableHighlights,
    language: options.language || undefined,
    genre,
    clipDurations: [
      [0, 30],
      [30, 60],
    ],
    prompt: buildViralClipPrompt({
      platform: options.platform,
      layoutTemplate: options.layoutTemplate,
      prompt: options.prompt,
    }),
  })
  if (!project.id) throw new Error('Reap create-clips returned no project id')
  return { projectId: project.id, uploadId, mode: 'clipping' }
}

export function reapClipsToViralSegments(clips: ReapClip[]): Array<{
  start: number
  end: number
  title: string
  explanation: string
  viralityScore: number
}> {
  return clips
    .filter((c) => typeof c.startTime === 'number' && typeof c.endTime === 'number')
    .map((c) => ({
      start: Number(c.startTime),
      end: Number(c.endTime),
      title: (c.title || c.topic || 'Viral moment').slice(0, 120),
      explanation: (c.caption || 'Reap AI selected this moment for virality.').slice(0, 400),
      // Reap scores 0–10; Clip Editor UI expects ~1–100
      viralityScore: Math.max(1, Math.min(100, Math.round((Number(c.viralityScore) || 5) * 10))),
    }))
    .slice(0, 10)
}
